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
const canvas = document.getElementById("platformVis");

let posX = 400,
  posY = 300; // Default position
let buffer = "";

// Draw the ball at the current position
function drawBall(x, y) {
  if (canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.arc(x, y, 40, 0, 2 * Math.PI);
    ctx.fillStyle = "LightGray";
    ctx.fill();
    ctx.stroke();
  }
}

// Send a request for position
async function requestPosition() {
  if (!outputStream) return;
  const writer = outputStream.getWriter();
  await writer.write("getPos\n");
  writer.releaseLock();
}

// Parse incoming messages for position
function handleSerialData(data) {
  // Expecting "123 456", but tolerate negatives/decimals
  const match = data.match(/^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/);
  if (match) {
    let x = Math.round(parseFloat(match[1]));
    let y = Math.round(parseFloat(match[2]));

    // Clamp within canvas size (account for radius = 40)
    const radius = 40;
    x = Math.max(radius, Math.min(canvas.width - radius, x));
    y = Math.max(radius, Math.min(canvas.height - radius, y));

    posX = x;
    posY = y;
    drawBall(posX, posY);
  }
}

// Read serial data and handle it
async function readLoop() {
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      console.log('[readLoop] DONE', done);
      break;
    }

    buffer += value;
    let lines = buffer.split("\n");
    buffer = lines.pop(); // save incomplete line

    for (let line of lines) {
      line = line.trim();
      if (line) {
        outputArea.value += line + "\n";
        outputArea.scrollTop = outputArea.scrollHeight;
        handleSerialData(line);

        // After handling a reply, request the next
        requestPosition();
      }
    }
  }
}

// Connect to serial port
connectButton.addEventListener('click', async () => {
  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });

    outputArea.value += 'Connected to serial port\n';

    const textDecoder = new TextDecoderStream();
    inputDone = port.readable.pipeTo(textDecoder.writable);
    inputStream = textDecoder.readable;

    reader = inputStream.getReader();
    readLoop();

    const textEncoder = new TextEncoderStream();
    outputDone = textEncoder.readable.pipeTo(port.writable);
    outputStream = textEncoder.writable;

    // Kick off first request
    requestPosition();
  } catch (err) {
    outputArea.value += `Error: ${err.message}\n`;
  }
});

// Send manual command
sendButton.addEventListener('click', async () => {
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
