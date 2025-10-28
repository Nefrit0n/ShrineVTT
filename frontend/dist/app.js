const statusEl = document.getElementById('connection-status');
const roleEl = document.getElementById('role-indicator');
const pingButton = document.getElementById('ping-button');
const logContainer = document.getElementById('log-entries');
const canvas = document.getElementById('scene-canvas');
const ctx = canvas.getContext('2d');

// Modal helpers
function modal(el) {
  return {
    open: () => el.setAttribute('data-open', 'true'),
    close: () => el.removeAttribute('data-open'),
    el,
  };
}

const gmModal = modal(document.getElementById('modal-gm'));
const joinModal = modal(document.getElementById('modal-join'));

// Close by backdrop or ✕
document.querySelectorAll('[data-close]').forEach((n) =>
  n.addEventListener('click', () => {
    gmModal.close();
    joinModal.close();
  }),
);

const STATUS_CLASSES = {
  ONLINE: 'pill--ok',
  OFFLINE: 'pill--danger',
};

const STATUS_LABELS = {
  ONLINE: 'В сети',
  OFFLINE: 'Не в сети',
};

const ROLE_LABELS = {
  MASTER: 'Мастер',
  PLAYER: 'Игрок',
  GUEST: 'Гость',
};

function logEvent(message, details) {
  const entry = document.createElement('article');
  entry.className = 'log-entry';

  const time = document.createElement('div');
  time.className = 'log-entry__time';
  time.textContent = new Date().toLocaleTimeString();
  entry.appendChild(time);

  const body = document.createElement('div');
  body.className = 'log-entry__message';
  body.textContent = message;
  entry.appendChild(body);

  if (details !== undefined) {
    const pre = document.createElement('pre');
    pre.className = 'log-entry__details';
    pre.textContent = typeof details === 'string' ? details : JSON.stringify(details, null, 2);
    entry.appendChild(pre);
  }

  logContainer.appendChild(entry);
  logContainer.scrollTo({ top: logContainer.scrollHeight, behavior: 'smooth' });
}

function setStatus(status) {
  statusEl.textContent = STATUS_LABELS[status] ?? status;
  statusEl.classList.remove(STATUS_CLASSES.ONLINE, STATUS_CLASSES.OFFLINE);
  statusEl.classList.add(STATUS_CLASSES[status] ?? STATUS_CLASSES.OFFLINE);
  if (status === 'ONLINE') pingButton.removeAttribute('disabled');
  else pingButton.setAttribute('disabled', '');
}

function updateRole(role) {
  const fallback = ROLE_LABELS.GUEST;
  if (!role) {
    roleEl.textContent = fallback;
    return;
  }
  roleEl.textContent = ROLE_LABELS[role] ?? fallback;
}

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
resizeCanvas();
addEventListener('resize', resizeCanvas);

const createRid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const pendingPings = new Map();

let socket = window.io('/ws', { autoConnect: false });

// GM Login flow (modal)
document
  .querySelectorAll('#gm-login-open, [data-trigger="gm"]')
  .forEach((el) => el.addEventListener('click', () => gmModal.open()));
document.getElementById('gm-login-btn').addEventListener('click', async () => {
  const passEl = document.getElementById('gm-password');
  const password = passEl.value.trim();
  if (!password) return;

  try {
    const res = await fetch('/api/auth/gm-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      logEvent('Не удалось войти как мастер');
      return;
    }

    const { token } = await res.json();
    localStorage.setItem('jwt', token);
    gmModal.close();

    socket.auth = { token };
    socket.connect();
  } catch (err) {
    logEvent('Сбой входа мастера', err?.message ?? String(err));
  }
});

// Player Join flow (modal)
document
  .querySelectorAll('#join-open, [data-trigger="join"]')
  .forEach((el) => el.addEventListener('click', () => joinModal.open()));
document.getElementById('join-session-btn').addEventListener('click', () => {
  const nickname = document.getElementById('join-nickname').value.trim();
  const sessionId = document.getElementById('join-session').value.trim() || null;
  if (!nickname) return;

  joinModal.close();
  socket.auth = { nickname, sessionId };
  socket.connect();
});

const tokenFromStorage = localStorage.getItem('jwt');
if (tokenFromStorage) {
  socket.auth = { token: tokenFromStorage };
  socket.connect();
}

socket.on('connect', () => {
  setStatus('ONLINE');

  const token = localStorage.getItem('jwt') || null;
  const { nickname, sessionId } = socket.auth || {};
  const role = token ? 'MASTER' : 'PLAYER';

  const envelope = {
    type: 'core.handshake:in',
    rid: createRid(),
    ts: Date.now(),
    payload: { role, nickname, sessionId, token },
  };

  socket.emit('message', envelope);
  logEvent('Рукопожатие отправлено', envelope);
});

socket.on('disconnect', (reason) => {
  setStatus('OFFLINE');
  logEvent(`Отключение: ${reason}`);
  updateRole('GUEST');
  pendingPings.clear();
});

socket.on('connect_error', (error) => {
  setStatus('OFFLINE');
  logEvent('Ошибка соединения', error?.message ?? error);
});

socket.on('message', (envelope) => {
  if (!envelope || typeof envelope !== 'object') {
    logEvent('Получен некорректный пакет');
    return;
  }

  const { type, rid, payload, ts } = envelope;
  switch (type) {
    case 'core.handshake:out': {
      const role = payload?.role ?? 'GUEST';
      updateRole(role);
      logEvent('Рукопожатие подтверждено', {
        role,
        sessionId: payload?.sessionId ?? null,
        ts,
        rid,
      });
      break;
    }
    case 'core.pong': {
      const started = pendingPings.get(rid);
      pendingPings.delete(rid);
      const latency = started !== undefined ? (performance.now() - started).toFixed(1) : null;
      logEvent('Получен отклик', {
        rid,
        latency: latency ? `${latency} мс` : 'н/д',
        payloadTs: payload?.ts,
        ts,
      });
      break;
    }
    default:
      logEvent(`Получен пакет: ${type}`, envelope);
  }
});

pingButton.addEventListener('click', () => {
  if (!socket.connected) return;
  const rid = createRid();
  const started = performance.now();
  pendingPings.set(rid, started);

  const envelope = {
    type: 'core.ping',
    rid,
    ts: Date.now(),
    payload: { origin: 'frontend' },
  };
  socket.emit('message', envelope);
  logEvent('Ping sent', { rid });
});

// Initial UI
setStatus('OFFLINE');
