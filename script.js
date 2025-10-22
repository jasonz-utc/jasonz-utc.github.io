let port;
let outputStream;
let isRemote = false;
let lastSend = 0;
let sending = false; // prevents async pileup

const connectButton = document.getElementById("connect");
const sendButton = document.getElementById("send");
const outputArea = document.getElementById("output");
const commandInput = document.getElementById("command");
const canvas = document.getElementById("platformVis");

let posX = canvas.width / 2;
let posY = canvas.height / 2;
let buffer = "";

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
  if (!outputStream || sending) return;
  const now = Date.now();
  if (now - lastSend < 30) return; // limit to ~33Hz
  sending = true;
  lastSend = now;

  try {
    const writer = outputStream.getWriter();
    await writer.write(line + "\n");
    writer.releaseLock();
  } catch (e) {
    console.error("Serial write error:", e);
  } finally {
    sending = false;
  }
}

async function readLoop() {
  const textDecoder = new TextDecoderStream();
  port.readable.pipeTo(textDecoder.writable);
  const reader = textDecoder.readable.getReader();
  let buffer = "";
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
}

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
canvas.parentNode.insertBefore(controlPanel, canvas);

connectButton.addEventListener("click", async () => {
  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    const textEncoder = new TextEncoderStream();
    textEncoder.readable.pipeTo(port.writable);
    outputStream = textEncoder.writable;
    readLoop();
    log("Connected to serial port.");
  } catch (err) {
    log("Error: " + err.message);
  }
});

// Manual send
sendButton.addEventListener("click", async () => {
  await sendSerial(commandInput.value);
  commandInput.value = "";
});

// --- Mouse control ---
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

  const scaledX = Math.round((posX / canvas.width) * 1000 - 500);
  const scaledY = Math.round((posY / canvas.height) * 1000 - 500);

  // Non-blocking, throttled send
  sendSerial(`${scaledX},${scaledY}`);
}

canvas.addEventListener("mousemove", sendSetpointFromMouse);
canvas.addEventListener("mouseleave", () => {
  if (isRemote) {
    drawBall(canvas.width / 2, canvas.height / 2);
    sendSerial("0,0");
  }
});

document.addEventListener("DOMContentLoaded", () => drawBall(posX, posY));
