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

connectButton.addEventListener('click', async () => {
  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 }); // Match Teensy's baud rate

    outputArea.value += 'Connected to serial port\n';

    const textDecoder = new TextDecoderStream();
    inputDone = port.readable.pipeTo(textDecoder.writable);
    inputStream = textDecoder.readable;

    reader = inputStream.getReader();
    readLoop();

    const textEncoder = new TextEncoderStream();
    outputDone = textEncoder.readable.pipeTo(port.writable);
    outputStream = textEncoder.writable;
  } catch (err) {
    outputArea.value += `Error: ${err.message}\n`;
  }
});

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

async function readLoop() {
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      console.log('[readLoop] DONE', done);
      break;
    }
    outputArea.value += value;
    outputArea.scrollTop = outputArea.scrollHeight;
  }
}
