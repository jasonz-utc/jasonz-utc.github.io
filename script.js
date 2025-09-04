let port;
let reader;
let inputDone;
let outputDone;
let inputStream;
let outputStream;

const connectButton = document.getElementById('connect');
const sendButton = document.getElementById('send');
const outputArea = document.getElementById('output');
const commandInput = document.getElementById('command');

let posX = 400,
  posY = 300; // Default position
let buffer = "";
let drawInterval;

const debugMode = false; // <- set to true if you want manual send

if (!debugMode) {
  sendButton.disabled = true;
  commandInput.disabled = true;
}

// Draw the ball at the current position
function drawBall(x, y) {
  const c = document.getElementById("platformVis");
  if (c) {
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.beginPath();
    ctx.arc(x, y, 40, 0, 2 * Math.PI);
    ctx.fillStyle = "LightGray";
    ctx.fill();
    ctx.stroke();
  }
}

// Clamp and round positions
function sanitizePos(x, y) {
  const c = document.getElementById("platformVis");
  if (!c) return { x, y };

  const radius = 40;
  const maxX = c.width - radius;
  const maxY = c.height - radius;
  const minX = radius;
  const minY = radius;

  return {
    x: Math.min(maxX, Math.max(minX, Math.round(x))),
    y: Math.min(maxY, Math.max(minY, Math.round(y))),
  };
}

// Parse incoming messages for position
function handleSerialLine(line) {
  // Expecting: "123 456"
  const match = line.match(/^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/);
  if (match) {
    let x = parseFloat(match[1]);
    let y = parseFloat(match[2]);
    ({ x, y } = sanitizePos(x, y));
    posX = x;
    posY = y;
    drawBall(posX, posY);
  }
}

// Read serial data and handle it with line buffering
async function readLoop() {
  const textDecoder = new TextDecoderStream();
  inputDone = port.readable.pipeTo(textDecoder.writable);
  inputStream = textDecoder.readable;
  reader = inputStream.getReader();

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        console.log('[readLoop] DONE', done);
        break;
      }
      if (value) {
        buffer += value;
        let lines = buffer.split(/\r?\n/);
        buffer = lines.pop(); // hold incomplete
        for (let line of lines) {
          if (line.trim().length > 0) {
            outputArea.value += line + "\n";
            outputArea.scrollTop = outputArea.scrollHeight;
            handleSerialLine(line.trim());
          }
        }
      }
    }
  } catch (err) {
    console.error("Read error:", err);
  }
}

// Start polling for position
function startPolling() {
  if (drawInterval) clearInterval(drawInterval);
  drawInterval = setInterval(async () => {
    if (outputStream) {
      const writer = outputStream.getWriter();
      await writer.write("getPos\n");
      writer.releaseLock();
    }
  }, 20); // ~30Hz
}

// Connect to serial port
connectButton.addEventListener('click', async () => {
  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });

    outputArea.value += 'Connected to serial port\n';

    readLoop();

    const textEncoder = new TextEncoderStream();
    outputDone = textEncoder.readable.pipeTo(port.writable);
    outputStream = textEncoder.writable;

    startPolling();
  } catch (err) {
    outputArea.value += `Error: ${err.message}\n`;
  }
});

// Send manual command (debug only)
sendButton.addEventListener('click', async () => {
  if (!debugMode) return;

  if (!outputStream) {
    outputArea.value += 'Not connected.\n';
    return;
  }

  const command = commandInput.value + '\n';
  const writer = outputStream.getWriter();
  await writer.write(command);
  writer.releaseLock();
  commandInput.value = '';
});

// Initial draw on page load
document.addEventListener('DOMContentLoaded', () => {
  drawBall(posX, posY);
});
