import { createJoinModal } from './ui/join.js';

const body = document.body;
const statusEl = document.getElementById('connection-status');
const roleEl = document.getElementById('role-indicator');
const sessionCodeEl = document.getElementById('session-code');
const sessionChipEl = document.getElementById('session-chip');
const createSessionBtn = document.getElementById('create-session-btn');
const loadSessionBtn = document.getElementById('load-session-btn');
const sessionCopyBtn = document.getElementById('session-copy-btn');
const sessionInviteBtn = document.getElementById('session-invite-btn');
const leaveSessionBtn = document.getElementById('leave-session-btn');
const logoutBtn = document.getElementById('logout-btn');
const pingButton = document.getElementById('ping-button');
const logContainer = document.getElementById('log-entries');
const logEmptyState = document.getElementById('log-empty');
const canvas = document.getElementById('scene-canvas');
const ctx = canvas.getContext('2d');
const visibilityTargets = Array.from(document.querySelectorAll('[data-visible]'));
const journalTextarea = document.getElementById('player-notes');
const journalStatusEl = document.getElementById('player-notes-status');
const sessionSavesModalEl = document.getElementById('modal-session-saves');
const sessionSavesList = document.getElementById('session-saves-list');
const sessionSavesEmpty = document.getElementById('session-saves-empty');
const sessionLoadConfirmBtn = document.getElementById('session-load-confirm');

const JOURNAL_SAVE_DEBOUNCE = 800;
const JOURNAL_STATUS_CLASSES = [
  'journal__status--idle',
  'journal__status--dirty',
  'journal__status--saving',
  'journal__status--saved',
  'journal__status--error',
  'journal__status--disabled',
];

const journalState = {
  loadedSessionId: null,
  loadingSessionId: null,
  saveTimeoutId: null,
  isSaving: false,
  savedValue: '',
};

const sessionSavesState = {
  sessions: [],
  selectedId: null,
  isLoading: false,
};

const STORAGE_KEYS = Object.freeze({
  TOKEN: 'jwt',
  SESSION_ID: 'sessionId',
  SESSION_CODE: 'sessionCode',
});

const STATUS_CLASSES = Object.freeze({
  ONLINE: 'pill--ok',
  OFFLINE: 'pill--danger',
});

const STATUS_LABELS = Object.freeze({
  ONLINE: 'В СЕТИ',
  OFFLINE: 'НЕ В СЕТИ',
});

const ROLE_LABELS = Object.freeze({
  MASTER: 'МАСТЕР',
  PLAYER: 'ИГРОК',
  GUEST: 'ГОСТЬ',
});

let currentRole = 'GUEST';
let isConnected = false;
let currentSessionId = null;
let currentSessionCode = null;
let socket = null;

body.dataset.role = currentRole.toLowerCase();
body.dataset.connection = 'offline';

function syncVisibility() {
  visibilityTargets.forEach((el) => {
    const raw = el.dataset.visible || '';
    const tokens = raw.split(/\s+/).filter(Boolean);
    if (!tokens.length) {
      el.removeAttribute('hidden');
      return;
    }

    const visible = tokens.some((token) => {
      if (token === 'ANY') return true;
      if (token === 'CONNECTED') return isConnected;
      if (token === 'DISCONNECTED') return !isConnected;
      return currentRole === token;
    });

    if (visible) el.removeAttribute('hidden');
    else el.setAttribute('hidden', '');
  });
}

function logEvent(message, details) {
  const entry = document.createElement('article');
  entry.className = 'log-entry';

  if (logEmptyState) {
    logEmptyState.setAttribute('hidden', '');
  }

  const time = document.createElement('div');
  time.className = 'log-entry__time';
  time.textContent = new Date().toLocaleTimeString();
  entry.appendChild(time);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'log-entry__message';
  bodyEl.textContent = message;
  entry.appendChild(bodyEl);

  if (details !== undefined) {
    const pre = document.createElement('pre');
    pre.className = 'log-entry__details';
    pre.textContent = typeof details === 'string' ? details : JSON.stringify(details, null, 2);
    entry.appendChild(pre);
  }

  logContainer.appendChild(entry);
  logContainer.scrollTo({ top: logContainer.scrollHeight, behavior: 'smooth' });
}

function setJournalStatus(text, variant = 'idle') {
  if (!journalStatusEl) return;
  if (typeof text === 'string') {
    journalStatusEl.textContent = text;
  }

  JOURNAL_STATUS_CLASSES.forEach((cls) => journalStatusEl.classList.remove(cls));
  const className = JOURNAL_STATUS_CLASSES.includes(`journal__status--${variant}`)
    ? `journal__status--${variant}`
    : 'journal__status--idle';
  journalStatusEl.classList.add(className);
}

function clearJournalSaveTimeout() {
  if (journalState.saveTimeoutId) {
    clearTimeout(journalState.saveTimeoutId);
    journalState.saveTimeoutId = null;
  }
}

function disableJournal(message, { clearValue = true } = {}) {
  if (!journalTextarea) return;
  clearJournalSaveTimeout();
  journalState.isSaving = false;
  journalState.loadingSessionId = null;
  journalState.loadedSessionId = null;
  journalState.savedValue = '';

  if (clearValue) {
    journalTextarea.value = '';
  }

  journalTextarea.setAttribute('disabled', '');
  setJournalStatus(message, 'disabled');
}

function refreshJournalAccess() {
  if (!journalTextarea) return;

  const token = getStoredToken();
  if (!currentSessionId || !token) {
    disableJournal('Подключитесь к сессии, чтобы вести заметки');
    return;
  }

  if (journalState.loadedSessionId !== currentSessionId && !journalState.loadingSessionId) {
    loadPlayerNotes(currentSessionId);
    return;
  }

  journalTextarea.removeAttribute('disabled');

  if (journalTextarea.value === journalState.savedValue) {
    setJournalStatus(journalTextarea.value ? 'Сохранено' : 'Готово к записи', journalTextarea.value ? 'saved' : 'idle');
  } else {
    setJournalStatus('Изменения не сохранены', 'dirty');
  }
}

async function loadPlayerNotes(sessionId = currentSessionId) {
  if (!journalTextarea) return;

  const token = getStoredToken();
  if (!sessionId || !token) {
    disableJournal('Подключитесь к сессии, чтобы вести заметки');
    return;
  }

  journalState.loadingSessionId = sessionId;
  setJournalStatus('Загрузка заметок…', 'saving');
  journalTextarea.setAttribute('disabled', '');

  try {
    const res = await fetch(`/api/sessions/${sessionId}/player-state`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      if (res.status === 403) {
        disableJournal('Нет доступа к журналу', { clearValue: false });
      } else {
        journalTextarea.removeAttribute('disabled');
        setJournalStatus('Не удалось загрузить заметки', 'error');
        logEvent('Ошибка загрузки заметок', `${res.status} ${res.statusText}`);
      }
      return;
    }

    const data = await res.json().catch(() => ({}));
    const notes = typeof data.notes === 'string' ? data.notes : '';

    if (currentSessionId !== sessionId) {
      return;
    }

    journalState.loadedSessionId = sessionId;
    journalState.savedValue = notes;
    journalTextarea.value = notes;
    journalTextarea.removeAttribute('disabled');
    setJournalStatus(notes ? 'Сохранено' : 'Готово к записи', notes ? 'saved' : 'idle');
  } catch (err) {
    if (currentSessionId === sessionId) {
      journalTextarea.removeAttribute('disabled');
      setJournalStatus('Не удалось загрузить заметки', 'error');
    }
    logEvent('Ошибка загрузки заметок', err?.message ?? String(err));
  } finally {
    if (journalState.loadingSessionId === sessionId) {
      journalState.loadingSessionId = null;
    }
  }
}

function scheduleJournalSave() {
  if (!journalTextarea || journalTextarea.hasAttribute('disabled')) return;
  clearJournalSaveTimeout();
  journalState.saveTimeoutId = setTimeout(() => {
    journalState.saveTimeoutId = null;
    savePlayerNotes();
  }, JOURNAL_SAVE_DEBOUNCE);
}

async function savePlayerNotes() {
  if (!journalTextarea) return;
  if (!currentSessionId) return;

  const token = getStoredToken();
  if (!token) {
    disableJournal('Подключитесь к сессии, чтобы вести заметки');
    return;
  }

  clearJournalSaveTimeout();

  const sessionId = currentSessionId;
  const value = journalTextarea.value;

  if (journalState.isSaving) return;
  if (value === journalState.savedValue) {
    setJournalStatus(value ? 'Сохранено' : 'Готово к записи', value ? 'saved' : 'idle');
    return;
  }

  journalState.isSaving = true;
  setJournalStatus('Сохранение…', 'saving');

  try {
    const res = await fetch(`/api/sessions/${sessionId}/player-state`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ notes: value }),
    });

    if (!res.ok) {
      if (res.status === 403) {
        disableJournal('Нет доступа к журналу', { clearValue: false });
      } else {
        setJournalStatus('Ошибка сохранения', 'error');
        logEvent('Ошибка сохранения заметок', `${res.status} ${res.statusText}`);
      }
      return;
    }

    const data = await res.json().catch(() => ({}));
    const notes = typeof data.notes === 'string' ? data.notes : value;

    if (currentSessionId !== sessionId) {
      return;
    }

    journalState.savedValue = notes;
    journalState.loadedSessionId = sessionId;
    if (journalTextarea.value !== notes) {
      journalTextarea.value = notes;
    }
    setJournalStatus(notes ? 'Сохранено' : 'Готово к записи', notes ? 'saved' : 'idle');
  } catch (err) {
    if (currentSessionId === sessionId) {
      setJournalStatus('Ошибка сохранения', 'error');
    }
    logEvent('Ошибка сохранения заметок', err?.message ?? String(err));
  } finally {
    journalState.isSaving = false;
    if (currentSessionId === sessionId) {
      if (journalTextarea.value !== journalState.savedValue && !journalTextarea.hasAttribute('disabled')) {
        setJournalStatus('Изменения не сохранены', 'dirty');
        scheduleJournalSave();
      }
    }
  }
}

function handleJournalInput() {
  if (!journalTextarea || journalTextarea.hasAttribute('disabled')) return;
  if (!currentSessionId || !getStoredToken()) {
    disableJournal('Подключитесь к сессии, чтобы вести заметки');
    return;
  }

  if (journalTextarea.value === journalState.savedValue) {
    if (!journalState.isSaving) {
      setJournalStatus(journalTextarea.value ? 'Сохранено' : 'Готово к записи', journalTextarea.value ? 'saved' : 'idle');
      clearJournalSaveTimeout();
    }
    return;
  }

  setJournalStatus('Изменения не сохранены', 'dirty');
  scheduleJournalSave();
}

function handleJournalSessionChange(previousSessionId, nextSessionId) {
  if (!journalTextarea) return;

  if (previousSessionId !== nextSessionId) {
    clearJournalSaveTimeout();
    journalState.savedValue = '';
    journalState.loadedSessionId = null;
  }

  if (!nextSessionId) {
    disableJournal('Подключитесь к сессии, чтобы вести заметки');
    return;
  }

  refreshJournalAccess();
}

function resetSessionSavesState({ keepSessions = false } = {}) {
  if (!keepSessions) {
    sessionSavesState.sessions = [];
  }
  sessionSavesState.selectedId = null;
  sessionSavesState.isLoading = false;
  if (sessionLoadConfirmBtn) {
    sessionLoadConfirmBtn.setAttribute('disabled', '');
  }
  if (sessionSavesList) {
    sessionSavesList.innerHTML = '';
  }
  if (sessionSavesEmpty) {
    sessionSavesEmpty.textContent = 'Войдите как Мастер, чтобы просмотреть сохранения.';
    sessionSavesEmpty.removeAttribute('hidden');
  }
}

function setSessionSavesLoading(isLoading) {
  sessionSavesState.isLoading = Boolean(isLoading);
  if (!sessionSavesEmpty) return;
  if (sessionSavesState.isLoading) {
    sessionSavesEmpty.textContent = 'Загружаем сохранения...';
    sessionSavesEmpty.removeAttribute('hidden');
  }
}

function formatSessionTimestamp(createdAt) {
  if (!createdAt) return '';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function selectSessionSave(sessionId) {
  sessionSavesState.selectedId = sessionId ?? null;
  if (!sessionSavesList) return;

  const buttons = sessionSavesList.querySelectorAll('.session-saves__button');
  buttons.forEach((btn) => {
    if (btn.dataset.sessionId === sessionSavesState.selectedId) {
      btn.classList.add('is-selected');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      btn.classList.remove('is-selected');
      btn.setAttribute('aria-pressed', 'false');
    }
  });

  if (sessionLoadConfirmBtn) {
    if (sessionSavesState.selectedId) {
      sessionLoadConfirmBtn.removeAttribute('disabled');
    } else {
      sessionLoadConfirmBtn.setAttribute('disabled', '');
    }
  }
}

function renderSessionSaves() {
  if (!sessionSavesList || !sessionSavesEmpty) return;

  sessionSavesList.innerHTML = '';

  if (sessionSavesState.isLoading) {
    return;
  }

  if (!sessionSavesState.sessions.length) {
    sessionSavesEmpty.textContent = 'Сохранения не найдены. Создайте новую сессию, чтобы начать.';
    sessionSavesEmpty.removeAttribute('hidden');
    if (sessionLoadConfirmBtn) {
      sessionLoadConfirmBtn.setAttribute('disabled', '');
    }
    return;
  }

  sessionSavesEmpty.setAttribute('hidden', '');

  sessionSavesState.sessions.forEach((session) => {
    const item = document.createElement('li');
    item.className = 'session-saves__item';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'session-saves__button';
    button.dataset.sessionId = session.id;
    button.dataset.sessionCode = session.code;
    button.setAttribute('aria-pressed', sessionSavesState.selectedId === session.id ? 'true' : 'false');

    const codeEl = document.createElement('span');
    codeEl.className = 'session-saves__code';
    codeEl.textContent = session.code;
    button.appendChild(codeEl);

    const metaEl = document.createElement('span');
    metaEl.className = 'session-saves__meta';
    metaEl.textContent = formatSessionTimestamp(session.createdAt) || '—';
    button.appendChild(metaEl);

    button.addEventListener('click', () => {
      selectSessionSave(session.id);
    });

    if (session.id === sessionSavesState.selectedId) {
      button.classList.add('is-selected');
    }

    item.appendChild(button);
    sessionSavesList.appendChild(item);
  });

  const initialSelection =
    sessionSavesState.selectedId ?? sessionSavesState.sessions[0]?.id ?? null;
  if (initialSelection && initialSelection !== sessionSavesState.selectedId) {
    selectSessionSave(initialSelection);
  }
}

async function refreshSessionSaves({ force = false, silent = false } = {}) {
  if (currentRole !== 'MASTER') {
    resetSessionSavesState();
    return [];
  }

  const token = getStoredToken();
  if (!token) {
    resetSessionSavesState();
    return [];
  }

  if (sessionSavesState.isLoading && !force) {
    return sessionSavesState.sessions;
  }

  setSessionSavesLoading(true);
  if (!silent) {
    renderSessionSaves();
  }

  try {
    const res = await fetch('/api/sessions', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error((await res.json().catch(() => ({})))?.error ?? 'Не удалось получить список сессий');
    }

    const payload = await res.json();
    const sessions = Array.isArray(payload?.sessions) ? payload.sessions : [];
    sessionSavesState.sessions = sessions.map((session) => ({
      id: session.id,
      code: String(session.code ?? '').toUpperCase(),
      createdAt: session.createdAt,
    }));
    sessionSavesState.selectedId = sessionSavesState.sessions.find((s) => s.id === currentSessionId)?.id ?? null;
    return sessionSavesState.sessions;
  } catch (err) {
    logEvent('Не удалось загрузить список сохранений', err?.message ?? String(err));
    sessionSavesState.sessions = [];
    sessionSavesState.selectedId = null;
    if (sessionSavesEmpty) {
      sessionSavesEmpty.textContent = 'Не удалось загрузить сохранения. Попробуйте ещё раз.';
      sessionSavesEmpty.removeAttribute('hidden');
    }
    return [];
  } finally {
    setSessionSavesLoading(false);
    renderSessionSaves();
  }
}

async function openSessionSavesModal() {
  if (!sessionSavesModal) return;
  sessionSavesState.selectedId = currentSessionId ?? null;
  sessionSavesModal.open();
  await refreshSessionSaves({ force: true, silent: true });
  renderSessionSaves();
}

async function handleSessionLoadConfirm() {
  const selectedId = sessionSavesState.selectedId;
  if (!selectedId) return;

  const session = sessionSavesState.sessions.find((s) => s.id === selectedId);
  if (!session) return;

  setSessionId(session.id);
  updateSessionCode(session.code);
  setSocketAuth();
  sessionSavesState.selectedId = session.id;
  renderSessionSaves();

  if (socket.connected) {
    sendHandshake({ sessionId: session.id });
  } else {
    socket.connect();
  }

  sessionSavesModal?.close();
  logEvent('Загружена сохранённая сессия', { sessionId: session.id, code: session.code });
}

async function leaveSession() {
  if (!currentSessionId) return;

  const sessionId = currentSessionId;
  const token = getStoredToken();

  if (token) {
    try {
      await fetch(`/api/sessions/${sessionId}/members/me`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      logEvent('Не удалось уведомить сервер о выходе из сессии', err?.message ?? String(err));
    }
  }

  setSessionId(null);
  updateSessionCode(null);
  setSocketAuth();
  selectSessionSave(null);
  refreshSessionSaves({ force: true, silent: true });
  sessionSavesModal?.close();

  if (socket.connected) {
    sendHandshake({ sessionId: null });
  }

  logEvent('Вы покинули сессию', { sessionId });
}

async function handleLogout() {
  const previousSessionId = currentSessionId;
  const token = getStoredToken();

  if (previousSessionId && token) {
    try {
      await fetch(`/api/sessions/${previousSessionId}/members/me`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      logEvent('Не удалось уведомить сервер о выходе из сессии', err?.message ?? String(err));
    }
  }

  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  setSessionId(null);
  updateSessionCode(null);
  resetSessionSavesState();
  sessionSavesModal?.close();
  setSocketAuth();

  if (socket.connected) {
    socket.disconnect();
  } else {
    updateRole('GUEST');
    updateSessionControls();
    syncVisibility();
  }

  logEvent('Вы вышли из роли');
}

function getStoredToken() {
  return localStorage.getItem(STORAGE_KEYS.TOKEN);
}

function setSocketAuth(extra = {}) {
  if (!socket) return;
  const token = getStoredToken();
  const authPayload = { ...extra };

  if (token) {
    authPayload.token = token;
  }
  if (currentSessionId) {
    authPayload.sessionId = currentSessionId;
  }

  socket.auth = authPayload;
}

function updateSessionControls() {
  const hasSession = Boolean(currentSessionId && currentSessionCode);
  const token = getStoredToken();

  if (sessionChipEl) {
    if (hasSession) sessionChipEl.removeAttribute('hidden');
    else sessionChipEl.setAttribute('hidden', '');
  }

  if (createSessionBtn) {
    const shouldShowCreate = currentRole === 'MASTER' && isConnected && !currentSessionId;
    if (shouldShowCreate) createSessionBtn.removeAttribute('hidden');
    else createSessionBtn.setAttribute('hidden', '');
    createSessionBtn.toggleAttribute('disabled', !isConnected);
  }

  if (loadSessionBtn) {
    const shouldShowLoad = currentRole === 'MASTER' && isConnected;
    if (shouldShowLoad) loadSessionBtn.removeAttribute('hidden');
    else loadSessionBtn.setAttribute('hidden', '');
    loadSessionBtn.toggleAttribute('disabled', !isConnected);
  }

  if (leaveSessionBtn) {
    const shouldShowLeave = Boolean(currentSessionId);
    if (shouldShowLeave) leaveSessionBtn.removeAttribute('hidden');
    else leaveSessionBtn.setAttribute('hidden', '');
    leaveSessionBtn.toggleAttribute('disabled', !currentSessionId || !isConnected);
  }

  if (logoutBtn) {
    const shouldShowLogout = currentRole !== 'GUEST' || Boolean(token);
    if (shouldShowLogout) logoutBtn.removeAttribute('hidden');
    else logoutBtn.setAttribute('hidden', '');
    logoutBtn.toggleAttribute('disabled', false);
  }

  sessionCopyBtn?.toggleAttribute('disabled', !hasSession);
  sessionInviteBtn?.toggleAttribute('disabled', !hasSession);
}

function updateSessionCode(value, { persist = true } = {}) {
  currentSessionCode = value ? String(value).toUpperCase() : null;
  if (sessionCodeEl) {
    sessionCodeEl.textContent = currentSessionCode ?? '—';
  }
  if (persist) {
    if (currentSessionCode) {
      localStorage.setItem(STORAGE_KEYS.SESSION_CODE, currentSessionCode);
    } else {
      localStorage.removeItem(STORAGE_KEYS.SESSION_CODE);
    }
  }
  updateSessionControls();
}

function setSessionId(value, { persist = true, syncAuth = true } = {}) {
  const previousSessionId = currentSessionId;
  currentSessionId = value && typeof value === 'string' ? value : null;
  if (persist) {
    if (currentSessionId) {
      localStorage.setItem(STORAGE_KEYS.SESSION_ID, currentSessionId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
    }
  }
  updateSessionControls();
  if (syncAuth) {
    setSocketAuth();
  }
  handleJournalSessionChange(previousSessionId, currentSessionId);
}

function setStatus(status) {
  const label = STATUS_LABELS[status] ?? STATUS_LABELS.OFFLINE;
  statusEl.textContent = label;
  statusEl.classList.remove(STATUS_CLASSES.ONLINE, STATUS_CLASSES.OFFLINE);
  statusEl.classList.add(STATUS_CLASSES[status] ?? STATUS_CLASSES.OFFLINE);
  isConnected = status === 'ONLINE';
  body.dataset.connection = isConnected ? 'online' : 'offline';
  if (status === 'ONLINE') {
    pingButton?.removeAttribute('disabled');
  } else {
    pingButton?.setAttribute('disabled', '');
  }
  updateSessionControls();
  syncVisibility();
}

function updateRole(role) {
  const normalized = typeof role === 'string' ? role.toUpperCase() : 'GUEST';
  const label = ROLE_LABELS[normalized] ?? ROLE_LABELS.GUEST;
  roleEl.textContent = label;
  currentRole = normalized in ROLE_LABELS ? normalized : 'GUEST';
  body.dataset.role = currentRole.toLowerCase();
  if (currentRole !== 'MASTER') {
    resetSessionSavesState();
    sessionSavesModal?.close();
  }
  updateSessionControls();
  syncVisibility();
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

function sendHandshake({ sessionId } = {}) {
  if (!socket || !socket.connected) return;
  const envelope = {
    type: 'core.handshake:in',
    rid: createRid(),
    ts: Date.now(),
    payload: {
      role: currentRole,
      sessionId: sessionId ?? currentSessionId ?? null,
    },
  };
  socket.emit('message', envelope);
  logEvent('Рукопожатие отправлено', envelope);
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  document.body.removeChild(area);
}

async function handleCopySessionCode() {
  if (!currentSessionCode) return;
  try {
    await copyText(currentSessionCode);
    logEvent('Код сессии скопирован', currentSessionCode);
  } catch (err) {
    logEvent('Не удалось скопировать код сессии', err?.message ?? String(err));
  }
}

async function handleCopyInviteLink() {
  if (!currentSessionCode) return;
  try {
    const inviteUrl = new URL(window.location.href);
    inviteUrl.searchParams.set('code', currentSessionCode);
    await copyText(inviteUrl.toString());
    logEvent('Ссылка-приглашение скопирована', inviteUrl.toString());
  } catch (err) {
    logEvent('Не удалось скопировать ссылку-приглашение', err?.message ?? String(err));
  }
}

async function createSession() {
  const token = getStoredToken();
  if (!token) {
    logEvent('Необходимо войти как Мастер, чтобы создать сессию');
    return;
  }
  if (!createSessionBtn) return;

  createSessionBtn.setAttribute('disabled', '');
  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = data?.error ?? 'Не удалось создать сессию';
      logEvent('Ошибка создания сессии', message);
      return;
    }

    const payload = await res.json();
    if (!payload?.sessionId || !payload?.code) {
      logEvent('Некорректный ответ сервера при создании сессии');
      return;
    }

    setSessionId(payload.sessionId);
    updateSessionCode(payload.code);
    setSocketAuth();
    sendHandshake({ sessionId: payload.sessionId });
    logEvent('Сессия создана', { sessionId: payload.sessionId, code: payload.code });
    refreshSessionSaves({ force: true, silent: true });
  } catch (err) {
    logEvent('Ошибка создания сессии', err?.message ?? String(err));
  } finally {
    createSessionBtn.removeAttribute('disabled');
    updateSessionControls();
  }
}

function openJoin() {
  const fallbackCode = currentSessionCode || localStorage.getItem(STORAGE_KEYS.SESSION_CODE) || '';
  joinModal.setValues({ code: fallbackCode });
  joinModal.open();
}

async function submitJoin(formData, helpers) {
  const { username, code } = formData;

  if (!username) {
    helpers.showError('Введите имя игрока');
    return;
  }

  if (!code || code.length !== 6) {
    helpers.showError('Введите код из 6 символов');
    return;
  }

  try {
    const res = await fetch('/api/sessions/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, code }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = data?.error ?? 'Не удалось подключиться к сессии';
      helpers.showError(message);
      logEvent('Ошибка подключения к сессии', message);
      return;
    }

    const payload = await res.json();
    if (!payload?.token || !payload?.sessionId) {
      helpers.showError('Некорректный ответ сервера');
      logEvent('Некорректный ответ при подключении к сессии');
      return;
    }

    localStorage.setItem(STORAGE_KEYS.TOKEN, payload.token);
    setSessionId(payload.sessionId);
    updateSessionCode(code);
    helpers.close();
    helpers.reset();
    setSocketAuth();

    if (socket.connected) {
      sendHandshake({ sessionId: payload.sessionId });
    } else {
      socket.connect();
    }

    logEvent('Игрок подключён к сессии', { username, sessionId: payload.sessionId });
  } catch (err) {
    helpers.showError('Не удалось подключиться. Попробуйте ещё раз.');
    logEvent('Ошибка подключения игрока', err?.message ?? String(err));
  }
}

async function handleGmLogin() {
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
      logEvent('Не удалось войти как Мастер');
      return;
    }

    const payload = await res.json();
    if (!payload?.token) {
      logEvent('Некорректный ответ при входе Мастера');
      return;
    }

    localStorage.setItem(STORAGE_KEYS.TOKEN, payload.token);
    gmModal.close();
    passEl.value = '';
    setSocketAuth();

    if (socket.connected) {
      sendHandshake();
    } else {
      socket.connect();
    }

    logEvent('Мастер вошёл в систему');
  } catch (err) {
    logEvent('Ошибка входа Мастера', err?.message ?? String(err));
  }
}

function sendPing() {
  if (!socket?.connected) return;
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
  logEvent('Пинг отправлен', { rid });
}

function modal(el) {
  return {
    open: () => el.setAttribute('data-open', 'true'),
    close: () => el.removeAttribute('data-open'),
    el,
  };
}

const gmModal = modal(document.getElementById('modal-gm'));
const sessionSavesModal = sessionSavesModalEl ? modal(sessionSavesModalEl) : null;
const joinModal = createJoinModal({ onSubmit: submitJoin });

document.querySelectorAll('[data-close]').forEach((node) =>
  node.addEventListener('click', () => {
    gmModal.close();
    joinModal.close();
    sessionSavesModal?.close();
  }),
);

document.getElementById('gm-login-open').addEventListener('click', () => gmModal.open());
document.getElementById('gm-login-btn').addEventListener('click', handleGmLogin);
document.getElementById('join-open').addEventListener('click', openJoin);
createSessionBtn?.addEventListener('click', createSession);
loadSessionBtn?.addEventListener('click', openSessionSavesModal);
sessionCopyBtn?.addEventListener('click', handleCopySessionCode);
sessionInviteBtn?.addEventListener('click', handleCopyInviteLink);
leaveSessionBtn?.addEventListener('click', () => {
  leaveSession();
});
logoutBtn?.addEventListener('click', () => {
  handleLogout();
});
pingButton?.addEventListener('click', sendPing);
journalTextarea?.addEventListener('input', handleJournalInput);
journalTextarea?.addEventListener('blur', () => {
  if (!journalTextarea || journalTextarea.hasAttribute('disabled')) return;
  if (journalTextarea.value !== journalState.savedValue) {
    savePlayerNotes();
  }
});

sessionLoadConfirmBtn?.addEventListener('click', handleSessionLoadConfirm);

if (journalTextarea) {
  disableJournal('Подключитесь к сессии, чтобы вести заметки');
}

const storedSessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
if (storedSessionId) {
  setSessionId(storedSessionId, { persist: false, syncAuth: false });
}

const storedSessionCode = localStorage.getItem(STORAGE_KEYS.SESSION_CODE);
if (storedSessionCode) {
  updateSessionCode(storedSessionCode, { persist: false });
}

const urlParams = new URLSearchParams(window.location.search);
const inviteCode = urlParams.get('code');
if (inviteCode) {
  joinModal.setValues({ code: inviteCode.toUpperCase().slice(0, 6) });
  urlParams.delete('code');
  const next = urlParams.toString();
  const cleanedUrl = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash}`;
  window.history.replaceState(null, document.title, cleanedUrl);
}

socket = window.io('/ws', { autoConnect: false });

const tokenFromStorage = getStoredToken();
if (tokenFromStorage) {
  setSocketAuth();
  socket.connect();
} else {
  updateSessionControls();
  syncVisibility();
}

socket.on('connect', () => {
  setStatus('ONLINE');
  setSocketAuth();
  sendHandshake();
});

socket.on('disconnect', (reason) => {
  setStatus('OFFLINE');
  logEvent(`Отключено: ${reason}`);
  updateRole('GUEST');
  pendingPings.clear();
});

socket.on('connect_error', (error) => {
  setStatus('OFFLINE');
  logEvent('Ошибка соединения', error?.message ?? error);
});

socket.on('message', (envelope) => {
  if (!envelope || typeof envelope !== 'object') {
    logEvent('Получен повреждённый конверт');
    return;
  }

  const { type, rid, payload, ts } = envelope;
  switch (type) {
    case 'core.handshake:out': {
      const role = payload?.role ?? 'GUEST';
      updateRole(role);

      const sessionId = payload?.sessionId ?? null;
      setSessionId(sessionId);

      if (!sessionId) {
        updateSessionCode(null);
      } else if (!currentSessionCode) {
        const remembered = localStorage.getItem(STORAGE_KEYS.SESSION_CODE);
        if (remembered) {
          updateSessionCode(remembered, { persist: false });
        }
      }

      if (role === 'MASTER') {
        refreshSessionSaves({ silent: true });
      } else {
        resetSessionSavesState();
        sessionSavesModal?.close();
      }

      logEvent('Рукопожатие подтверждено', {
        role,
        sessionId,
        username: payload?.username ?? null,
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
        latency: latency ? `${latency} ms` : 'н/д',
        payloadTs: payload?.ts,
        ts,
      });
      break;
    }
    default:
      logEvent(`Получен конверт: ${type}`, envelope);
  }
});

setStatus('OFFLINE');
syncVisibility();
