const statusEl = document.getElementById('connection-status');
const roleEl = document.getElementById('role-indicator');
const pingButton = document.getElementById('ping-button');
const logContainer = document.getElementById('log-entries');
const canvas = document.getElementById('scene-canvas');
const ctx = canvas.getContext('2d');

const STATUS_CLASSES = {
  ONLINE: 'status-indicator--online',
  OFFLINE: 'status-indicator--offline',
};

function logEvent(message, details) {
  const entry = document.createElement('article');
  entry.className = 'log-entry';

  const time = document.createElement('div');
  time.className = 'log-entry__time';
  time.textContent = new Date().toLocaleTimeString();
  entry.appendChild(time);

  const body = document.createElement('p');
  body.className = 'log-entry__message';
  body.textContent = message;
  entry.appendChild(body);

  if (details !== undefined) {
    const detailBlock = document.createElement('pre');
    detailBlock.className = 'log-entry__details';
    detailBlock.textContent = typeof details === 'string' ? details : JSON.stringify(details, null, 2);
    entry.appendChild(detailBlock);
  }

  logContainer.appendChild(entry);
  logContainer.scrollTo({ top: logContainer.scrollHeight, behavior: 'smooth' });
}

function setStatus(status) {
  statusEl.textContent = status;
  statusEl.classList.remove(STATUS_CLASSES.ONLINE, STATUS_CLASSES.OFFLINE);
  const className = STATUS_CLASSES[status] ?? STATUS_CLASSES.OFFLINE;
  statusEl.classList.add(className);
  if (status === 'ONLINE') {
    pingButton.removeAttribute('disabled');
  } else {
    pingButton.setAttribute('disabled', '');
  }
}

function updateRole(role) {
  roleEl.textContent = role ?? 'GUEST';
}

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const createRid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

const pendingPings = new Map();

function sendHandshake(socket) {
  const rid = createRid();
  const envelope = {
    type: 'core.handshake:in',
    rid,
    ts: Date.now(),
    payload: {
      client: 'frontend',
      version: '0.1.0',
    },
  };
  socket.emit('message', envelope);
  logEvent('Handshake sent', envelope);
}

function sendPing(socket) {
  const rid = createRid();
  const started = performance.now();
  pendingPings.set(rid, started);
  const envelope = {
    type: 'core.ping',
    rid,
    ts: Date.now(),
    payload: {
      origin: 'frontend',
    },
  };
  socket.emit('message', envelope);
  logEvent('Ping sent', { rid });
}

let socket;

try {
  socket = window.io();
} catch (error) {
  logEvent('Failed to initialize Socket.IO client', error?.message ?? error);
}

if (socket) {
  socket.on('connect', () => {
    setStatus('ONLINE');
    logEvent('Connected to ShrineVTT server');
    sendHandshake(socket);
  });

  socket.on('disconnect', (reason) => {
    setStatus('OFFLINE');
    logEvent(`Disconnected: ${reason}`);
    updateRole('GUEST');
    pendingPings.clear();
  });

  socket.on('connect_error', (error) => {
    setStatus('OFFLINE');
    logEvent('Connection error', error?.message ?? error);
  });

  socket.on('message', (envelope) => {
    if (!envelope || typeof envelope !== 'object') {
      logEvent('Received malformed envelope');
      return;
    }

    const { type, rid, payload, ts } = envelope;
    switch (type) {
      case 'core.handshake:out': {
        const role = payload?.role ?? 'GUEST';
        updateRole(role);
        logEvent('Handshake acknowledged', { role, sessionId: payload?.sessionId, ts, rid });
        break;
      }
      case 'core.pong': {
        const started = pendingPings.get(rid);
        pendingPings.delete(rid);
        const latency = started !== undefined ? (performance.now() - started).toFixed(1) : null;
        logEvent('Pong received', {
          rid,
          latency: latency ? `${latency} ms` : 'n/a',
          payloadTs: payload?.ts,
          ts,
        });
        break;
      }
      default: {
        logEvent(`Received envelope: ${type}`, envelope);
      }
    }
  });

  pingButton.addEventListener('click', () => {
    if (socket.connected) {
      sendPing(socket);
    }
  });
} else {
  setStatus('OFFLINE');
}
