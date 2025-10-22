let port;
let reader;
let outputStream;
let outputDone;
let inputStream;
let inputDone;
let isRemote = false;
let lastSend = 0;
let posX, posY, canvas, outputArea, commandInput;

function drawBall(x, y) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  ctx.arc(x, y, 40, 0, 2 * Math.PI);
  ctx.fillStyle = "LightGray";
  ctx.fill();
  ctx.stroke();
}

function clampCoords(x, y) {
  const radius = 40;
  return {
    x: Math.min(canvas.width - radius, Math.max(radius, Math.round(x))),
    y: Math.min(canvas.height - radius, Math.max(radius, Math.round(y))),
  };
}

function log(msg) {
  outputArea.value += msg + "\n";
  outputArea.scrollTop = outputArea.scrollHeight;
}

async function sendSerial(line) {
  if (!outputStream) return;
  const now = Date.now();
  if (now - lastSend < 30) return; // ~33 Hz limit
  lastSend = now;

  const writer = outputStream.getWriter();
  await writer.write(line + "\n");
  writer.releaseLock();
}

async function readLoop() {
  const textDecoder = new TextDecoderStream();
  inputDone = port.readable.pipeTo(textDecoder.writable);
  inputStream = textDecoder.readable;
  reader = inputStream.getReader();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        buffer += value;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop();
        for (let line of lines) {
          if (line.trim()) log(line.trim());
        }
      }
    }
  } catch (err) {
    log("Read error: " + err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // --- DOM references ---
  canvas = document.getElementById("platformVis");
  outputArea = document.getElementById("output");
  commandInput = document.getElementById("command");
  const connectButton = document.getElementById("connect");
  const sendButton = document.getElementById("send");

  posX = canvas.width / 2;
  posY = canvas.height / 2;

  drawBall(posX, posY);

  // --- Control buttons ---
  const controlPanel = document.createElement("div");
  ["init", "standalone", "pause", "remote"].forEach((cmd) => {
    const btn = document.createElement("button");
    btn.textContent = cmd.toUpperCase();
    btn.style.margin = "5px";
    btn.onclick = async () => {
      await sendSerial(cmd);
      isRemote = cmd === "remote";
      log("Sent: " + cmd);
      if (!isRemote) sendSerial("0,0");
    };
    controlPanel.appendChild(btn);
  });
  // Insert control panel right before the canvas
  canvas.parentNode.insertBefore(controlPanel, canvas);

  // --- Connect button ---
  connectButton.addEventListener("click", async () => {
    try {
      port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      const textEncoder = new TextEncoderStream();
      outputDone = textEncoder.readable.pipeTo(port.writable);
      outputStream = textEncoder.writable;
      readLoop();
      log("Connected to serial port.");
    } catch (err) {
      log("Error: " + err.message);
    }
  });

  // --- Manual send (debug) ---
  sendButton.addEventListener("click", async () => {
    if (!outputStream) {
      log("Not connected.");
      return;
    }
    await sendSerial(commandInput.value);
    commandInput.value = "";
  });

  // --- Mouse-based remote control ---
  function sendSetpointFromMouse(e) {
    if (!isRemote || !outputStream) return;

    const rect = canvas.getBoundingClientRect();
    const inside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;

    if (!inside) {
      drawBall(canvas.width / 2, canvas.height / 2);
      sendSerial("0,0");
      return;
    }

    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    const { x: clampedX, y: clampedY } = clampCoords(rawX, rawY);
    posX = clampedX;
    posY = clampedY;
    drawBall(posX, posY);

    // Map 0–800 → −500–+500 and 0–600 → −500–+500
    const scaledX = Math.round((posX / canvas.width) * 1000 - 500);
    const scaledY = Math.round((posY / canvas.height) * 1000 - 500);

    sendSerial(`${scaledX},${scaledY}`);
  }

  canvas.addEventListener("mousemove", sendSetpointFromMouse);
  canvas.addEventListener("mouseleave", () => {
    if (isRemote) {
      drawBall(canvas.width / 2, canvas.height / 2);
      sendSerial("0,0");
    }
  });
});
