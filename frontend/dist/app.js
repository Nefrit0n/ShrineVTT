const statusEl = document.getElementById('connection-status');
const roleEl = document.getElementById('role-indicator');
const pingButton = document.getElementById('ping-button');
const logContainer = document.getElementById('log-entries');
const canvas = document.getElementById('scene-canvas');
const sessionCodeEl = document.getElementById('session-code');
const disconnectBtn = document.getElementById('disconnect-btn');
const ctx = canvas.getContext('2d');

const controlSections = document.querySelectorAll('#control-panel [data-role]');

function modal(el) {
  return {
    open: () => el.setAttribute('data-open', 'true'),
    close: () => el.removeAttribute('data-open'),
    el,
  };
}

const gmModal = modal(document.getElementById('modal-gm'));
const joinModal = modal(document.getElementById('modal-join'));

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
  ONLINE: 'Онлайн',
  OFFLINE: 'Офлайн',
};

const ROLE_LABELS = {
  MASTER: 'Ведущий',
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
  const normalized = status === 'ONLINE' ? 'ONLINE' : 'OFFLINE';
  statusEl.textContent = STATUS_LABELS[normalized];
  statusEl.classList.remove(STATUS_CLASSES.ONLINE, STATUS_CLASSES.OFFLINE);
  statusEl.classList.add(STATUS_CLASSES[normalized]);
  if (normalized === 'ONLINE') {
    pingButton?.removeAttribute('disabled');
    disconnectBtn.removeAttribute('disabled');
  } else {
    pingButton?.setAttribute('disabled', '');
    disconnectBtn.setAttribute('disabled', '');
  }
}

function applyRoleUI(role) {
  const normalized = (role ?? 'GUEST').toUpperCase();
  controlSections.forEach((section) => {
    const target = section.dataset.role;
    if (target === 'gm') {
      section.hidden = normalized !== 'MASTER';
    } else if (target === 'player') {
      section.hidden = normalized !== 'PLAYER' && normalized !== 'MASTER';
    }
  });
}

function updateRole(role) {
  const normalized = (role ?? 'GUEST').toUpperCase();
  roleEl.textContent = ROLE_LABELS[normalized] ?? ROLE_LABELS.GUEST;
  applyRoleUI(normalized);
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

function resetSessionCode() {
  sessionCodeEl.textContent = '—';
  sessionCodeEl.setAttribute('disabled', '');
  sessionCodeEl.dataset.code = '';
}

function setSessionCode(sessionId) {
  if (sessionId) {
    sessionCodeEl.textContent = sessionId;
    sessionCodeEl.removeAttribute('disabled');
    sessionCodeEl.dataset.code = sessionId;
  } else {
    resetSessionCode();
  }
}

sessionCodeEl.addEventListener('click', async () => {
  const code = sessionCodeEl.dataset.code;
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    sessionCodeEl.textContent = 'Скопировано!';
    setTimeout(() => {
      sessionCodeEl.textContent = code;
    }, 2000);
    logEvent('Код сессии скопирован', code);
  } catch (error) {
    logEvent('Не удалось скопировать код', error?.message ?? String(error));
  }
});

// GM Login

document.getElementById('gm-login-open').addEventListener('click', () => gmModal.open());
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
      logEvent('Ошибка входа ведущего');
      return;
    }

    const { token } = await res.json();
    localStorage.setItem('jwt', token);
    gmModal.close();

    socket.auth = { token };
    socket.connect();
    logEvent('Запрос на запуск сессии отправлен');
  } catch (err) {
    logEvent('Ошибка сети при входе ведущего', err?.message ?? String(err));
  }
});

// Player join

document.getElementById('join-open').addEventListener('click', () => joinModal.open());
document.getElementById('join-session-btn').addEventListener('click', () => {
  const nickname = document.getElementById('join-nickname').value.trim();
  const sessionId = document.getElementById('join-session').value.trim() || null;
  if (!nickname) return;

  joinModal.close();
  socket.auth = { nickname, sessionId };
  socket.connect();
  logEvent('Попытка подключения игрока', { nickname, sessionId });
});

// Disconnect manually
disconnectBtn.addEventListener('click', () => {
  if (!socket.connected) return;
  logEvent('Отключение от сервера инициировано пользователем');
  socket.disconnect();
  socket.auth = {};
  localStorage.removeItem('jwt');
  updateRole('GUEST');
  resetSessionCode();
});

const tokenFromStorage = localStorage.getItem('jwt');
if (tokenFromStorage) {
  socket.auth = { token: tokenFromStorage };
  socket.connect();
  logEvent('Обнаружен сохранённый токен. Автоподключение...');
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
  logEvent('Отправлено рукопожатие', envelope);
});

socket.on('disconnect', (reason) => {
  setStatus('OFFLINE');
  logEvent(`Соединение закрыто: ${reason}`);
  updateRole('GUEST');
  pendingPings.clear();
  resetSessionCode();
});

socket.on('connect_error', (error) => {
  setStatus('OFFLINE');
  logEvent('Ошибка подключения', error?.message ?? error);
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
      setSessionCode(payload?.sessionId ?? null);
      logEvent('Рукопожатие подтверждено', {
        роль: role,
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
      logEvent('Получен pong', {
        rid,
        задержка: latency ? `${latency} мс` : 'n/a',
        времяОтправки: payload?.ts,
        ts,
      });
      break;
    }
    default:
      logEvent(`Получено сообщение: ${type}`, envelope);
  }
});

pingButton?.addEventListener('click', () => {
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
  logEvent('Отправлен ping', { rid });
});

setStatus('OFFLINE');
updateRole('GUEST');
resetSessionCode();
