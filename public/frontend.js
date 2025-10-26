const canvas = document.getElementById('vtt-canvas');
const context = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - document.querySelector('header').offsetHeight - document.querySelector('footer').offsetHeight;
  drawBackground();
}

function drawBackground() {
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#111827');
  gradient.addColorStop(1, '#1f2937');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const socket = new WebSocket(`ws://${window.location.host}`);

socket.addEventListener('open', () => {
  console.log('Connected to ShrineVTT WebSocket');
  socket.send(JSON.stringify({ type: 'join', message: 'Frontend connected' }));
});

socket.addEventListener('message', (event) => {
  try {
    const data = JSON.parse(event.data);
    console.log('Received event:', data);
  } catch (error) {
    console.log('Received raw message:', event.data);
  }
});

socket.addEventListener('close', () => {
  console.log('Disconnected from ShrineVTT WebSocket');
});
