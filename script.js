let port, writer;
let isRemote = false;
let isPatternMode = false;
let patternPlaying = false;
let patternPoints = [];
let posX, posY, lastX = null, lastY = null;
let canvas, outputArea, commandInput;

// ---------- helpers ----------
function drawBall(x, y) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw recorded path if any
  if (patternPoints.length > 1) {
    ctx.beginPath();
    ctx.moveTo(patternPoints[0].x, patternPoints[0].y);
    for (let i = 1; i < patternPoints.length; i++)
      ctx.lineTo(patternPoints[i].x, patternPoints[i].y);
    ctx.strokeStyle = "#00a";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Draw cursor/ball
  ctx.beginPath();
  ctx.arc(x, y, 40, 0, 2 * Math.PI);
  ctx.fillStyle = isPatternMode ? "LightBlue" : "LightGray";
  ctx.fill();
  ctx.stroke();
}

function log(msg) {
  outputArea.value += msg + "\n";
  outputArea.scrollTop = outputArea.scrollHeight;
}

async function sendSerial(line) {
  if (!writer) return;
  try {
    await writer.write(new TextEncoder().encode(line + "\n"));
  } catch (err) {
    console.error("Serial write failed:", err);
  }
}

async function readLoop() {
  const decoder = new TextDecoder();
  const reader = port.readable.getReader();
  let buffer = "";
  try {
    while (port && port.readable) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop();
        for (let line of lines) {
          if (line.trim()) log(line.trim());
        }
      }
      await new Promise((r) => setTimeout(r, 5)); // yield
    }
  } catch (err) {
    console.warn("readLoop error:", err);
  } finally {
    reader.releaseLock();
  }
}

// ---------- main ----------
document.addEventListener("DOMContentLoaded", () => {
  canvas = document.getElementById("platformVis");
  outputArea = document.getElementById("output");
  commandInput = document.getElementById("command");
  const connectButton = document.getElementById("connect");
  const sendButton = document.getElementById("send");

  posX = canvas.width / 2;
  posY = canvas.height / 2;
  drawBall(posX, posY);

  // --- Control buttons ---
  const panel = document.createElement("div");
  const addBtn = (label, fn) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.margin = "5px";
    b.onclick = fn;
    panel.appendChild(b);
  };

  ["init", "standalone", "pause", "remote"].forEach((cmd) => {
    addBtn(cmd.toUpperCase(), async () => {
      await sendSerial(cmd);
      isRemote = cmd === "remote";
      isPatternMode = false;
      log("Sent: " + cmd);
      if (!isRemote) sendSerial("0,0");
    });
  });

  addBtn("PATTERN MODE", () => {
    isPatternMode = !isPatternMode;
    isRemote = false;
    patternPlaying = false;
    patternPoints = [];
    log("Pattern mode " + (isPatternMode ? "enabled" : "disabled"));
    drawBall(posX, posY);
  });

  addBtn("PLAY PATTERN", async () => {
    if (!patternPoints.length) {
      log("No pattern recorded.");
      return;
    }
    if (patternPlaying) {
      log("Already playing.");
      return;
    }
    patternPlaying = true;
    log("Playing pattern...");
    isRemote = true;
    for (let i = 0; i < patternPoints.length && patternPlaying; i++) {
      const p = patternPoints[i];
      const scaledX = Math.round((p.x / canvas.width) * 1000 - 500);
      const scaledY = -1*Math.round((p.y / canvas.height) * 1000 - 500);
      await sendSerial(`${scaledX},${scaledY}`);
      drawBall(p.x, p.y);
      console.log("PLAYLOOP index", i, "patternPlaying=", patternPlaying);
      await new Promise((r) => setTimeout(r, 100)); // 10 Hz playback
    }
    patternPlaying = false;
    sendSerial("0,0");
    log("Pattern playback complete.");
  });

  addBtn("STOP PATTERN", () => {
    patternPlaying = false;
    log("Pattern playback stopped.");
  });

  canvas.parentNode.insertBefore(panel, canvas);

  // --- Connect serial ---
  connectButton.addEventListener("click", async () => {
    try {
      port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      writer = port.writable.getWriter();
      readLoop();
      log("Connected.");
    } catch (e) {
      log("Open failed: " + e.message);
    }
  });

  // --- Manual send (debug) ---
  sendButton.addEventListener("click", async () => {
    await sendSerial(commandInput.value);
    commandInput.value = "";
  });

    // --- Mouse interaction ---
  let drawing = false;
  const MIN_DIST = 5; // pixels between recorded points

  canvas.addEventListener("mousedown", (e) => {
    if (!isPatternMode) return;
    drawing = true;
    patternPoints = [];
    const rect = canvas.getBoundingClientRect();
const scaleX = canvas.width / rect.width;
const scaleY = canvas.height / rect.height;
const x = (e.clientX - rect.left) * scaleX;
const y = (e.clientY - rect.top) * scaleY;

    patternPoints.push({ x, y });
    drawBall(x, y);
  });

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
const scaleX = canvas.width / rect.width;
const scaleY = canvas.height / rect.height;
const x = (e.clientX - rect.left) * scaleX;
const y = (e.clientY - rect.top) * scaleY;


    if (isPatternMode && drawing) {
      if (patternPoints.length === 0) {
        patternPoints.push({ x, y });
      } else {
        const last = patternPoints[patternPoints.length - 1];
        const dx = x - last.x;
        const dy = y - last.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= MIN_DIST) {
          patternPoints.push({ x, y });
          drawBall(x, y);
        }
      }
    } else if (isRemote) {
      posX = x;
      posY = y;
    }
  });

  canvas.addEventListener("mouseup", () => {
    drawing = false;
    if (isPatternMode)
      log(`Pattern recorded (${patternPoints.length} points after spacing).`);
  });


  canvas.addEventListener("mouseleave", () => {
    if (isRemote) {
      posX = canvas.width / 2;
      posY = canvas.height / 2;
      sendSerial("0,0");
      drawBall(posX, posY);
    }
    drawing = false;
  });

  // --- Fixed-rate sender for remote mode ---
  setInterval(() => {
    if (!isRemote || !writer) return;
    const scaledX = Math.round((posX / canvas.width) * 1000 - 500);
    const scaledY = -1*Math.round((posY / canvas.height) * 1000 - 500);
    if (scaledX !== lastX || scaledY !== lastY) {
      drawBall(posX, posY);
      sendSerial(`${scaledX},${scaledY}`);
      lastX = scaledX;
      lastY = scaledY;
    }
  }, 100); // 10 Hz
});
