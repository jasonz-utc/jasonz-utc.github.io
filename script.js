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
let drawInterval;

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

// Start polling for position
function startPolling() {
  if (drawInterval) clearInterval(drawInterval);
  drawInterval = setInterval(async () => {
    if (outputStream) {
      const writer = outputStream.getWriter();
      await writer.write("getPos\n");
      writer.releaseLock();
    }
  }, 33); // ~30 times per second
}

// Parse incoming messages for position
function handleSerialData(data) {
  // Expecting: "123 456"
  const match = data.match(/^(\d+)\s+(\d+)/);
  if (match) {
    posX = parseInt(match[1], 10);
    posY = parseInt(match[2], 10);
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
    outputArea.value += value;
    outputArea.scrollTop = outputArea.scrollHeight;
    handleSerialData(value);
  }
}

// Connect to serial port and start polling
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

    startPolling(); // Start sending getPos
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
