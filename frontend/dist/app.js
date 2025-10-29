import { createJoinModal } from './ui/join.js';
import PixiStage from './canvas/PixiStage.js';
import DragTool from './tools/DragTool.js';

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
const boardOverlay = document.getElementById('board-overlay');
const boardOverlayTitle = document.getElementById('board-overlay-title');
const boardOverlayText = document.getElementById('board-overlay-text');
const boardOverlayRetry = document.getElementById('board-overlay-retry');
const boardFrame = boardOverlay?.parentElement ?? canvas?.closest('.board__frame') ?? null;

let boardLoadingOverlay = null;

if (boardFrame) {
  boardLoadingOverlay = document.createElement('div');
  boardLoadingOverlay.id = 'board-loading';
  boardLoadingOverlay.className = 'board__loading';
  boardLoadingOverlay.innerHTML = `
    <div class="board__spinner" role="status" aria-live="polite">
      <div class="board__spinner-icon" aria-hidden="true"></div>
      <p class="board__spinner-text">Загружаем сцену…</p>
    </div>
  `;
  boardFrame.appendChild(boardLoadingOverlay);
}

function showBoardLoadingOverlay() {
  boardLoadingOverlay?.removeAttribute('hidden');
}

function hideBoardLoadingOverlay() {
  if (!boardLoadingOverlay) return;
  boardLoadingOverlay.setAttribute('hidden', '');
}
const visibilityTargets = Array.from(document.querySelectorAll('[data-visible]'));
const journalTextarea = document.getElementById('player-notes');
const journalStatusEl = document.getElementById('player-notes-status');
const sessionSavesModalEl = document.getElementById('modal-session-saves');
const sessionSavesList = document.getElementById('session-saves-list');
const sessionSavesEmpty = document.getElementById('session-saves-empty');
const sessionLoadConfirmBtn = document.getElementById('session-load-confirm');
const createSceneForm = document.getElementById('create-scene-form');
const createSceneSubmitBtn = document.getElementById('create-scene-submit');
const createSceneStatus = document.getElementById('scene-form-status');
const createSceneResult = document.getElementById('scene-form-result');
const createSceneResultName = document.getElementById('scene-form-result-name');
const createSceneResultText = document.getElementById('scene-form-result-text');
const createSceneResultBadge = document.getElementById('scene-form-result-badge');
const makeActiveSceneBtn = document.getElementById('scene-form-make-active');
const sceneNameInput = document.getElementById('scene-name-input');
const sceneGridInput = document.getElementById('scene-grid-input');
const sceneWidthInput = document.getElementById('scene-width-input');
const sceneHeightInput = document.getElementById('scene-height-input');
const gmDragToggle = document.getElementById('gm-drag-toggle');

const gmTokensToolsItem = Array.from(document.querySelectorAll('.tool-list__item')).find((item) => {
  const label = item?.querySelector?.('.tool-list__label');
  if (!label) return false;
  return label.textContent?.includes('Жетоны игроков');
});

let tokenForm = null;
let tokenNameInput = null;
let tokenXInput = null;
let tokenYInput = null;
let tokenSubmitBtn = null;
let tokenStatusEl = null;
let tokenListContainer = null;
let tokenListHeader = null;
let tokenListBody = null;
let tokenListStatusEl = null;

const tokenToolsState = {
  isSubmitting: false,
  statusVariant: 'idle',
  statusResetTimeoutId: null,
};

const pendingTokenCreates = new Map();
const pendingTokenMoves = new Map();
const pendingOwnerAssignments = new Map();
const ownerAssignmentByRid = new Map();

const tokenListState = {
  tokens: new Map(),
};

const sessionMembersState = {
  members: [],
  isLoading: false,
  lastSessionId: null,
  error: null,
};

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

const sceneFormState = {
  lastSceneId: null,
  lastSceneName: '',
  activeSceneId: null,
  isSubmitting: false,
  isActivating: false,
  statusVariant: 'idle',
};

const canvasState = {
  activeSceneId: null,
  gridSize: null,
  isLoading: false,
};

let pixiStage = null;
let pixiStagePromise = null;
let dragTool = null;
let gmDragMode = false;

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
let currentUserId = null;
let socket = null;
let hasReceivedInitialSnapshot = false;

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

async function ensurePixiStage() {
  if (!canvas) return null;
  if (pixiStage) {
    hideBoardLoadingOverlay();
    return pixiStage;
  }
  if (!pixiStagePromise) {
    showBoardLoadingOverlay();
    pixiStagePromise = PixiStage.create({ canvas })
      .then((stage) => {
        pixiStage = stage;
        stage.setTokenMoveHandler({
          canMoveToken: canCurrentUserMoveToken,
          requestMove: handleStageTokenMoveRequest,
          userContext: {
            isGM: currentRole === 'MASTER',
            userId: currentUserId,
            canDragTokens: currentRole === 'MASTER' ? gmDragMode : true,
          },
        });
        hideBoardLoadingOverlay();
        return stage;
      })
      .catch((err) => {
        pixiStagePromise = null;
        hideBoardLoadingOverlay();
        logEvent('Не удалось инициализировать полотно', err?.message ?? String(err));
        return null;
      });
  }
  return pixiStagePromise;
}

function canCurrentUserMoveToken(token) {
  if (!token || typeof token !== 'object') {
    return false;
  }

  if (!socket || !socket.connected) {
    return false;
  }

  if (!currentSessionId || !canvasState.activeSceneId) {
    return false;
  }

  if (currentRole === 'MASTER') {
    return gmDragMode;
  }

  if (currentRole === 'PLAYER') {
    if (!currentUserId) {
      return false;
    }
    return token.ownerUserId === currentUserId;
  }

  return false;
}

async function updateStageMovePermissions() {
  const stage = await ensurePixiStage();
  if (!stage) {
    return;
  }
  stage.setTokenMoveHandler({
    canMoveToken: canCurrentUserMoveToken,
    requestMove: handleStageTokenMoveRequest,
    userContext: {
      isGM: currentRole === 'MASTER',
      userId: currentUserId,
      canDragTokens: currentRole === 'MASTER' ? gmDragMode : true,
    },
  });
}

function handleStageTokenMoveRequest({ tokenId, xCell, yCell, version }) {
  if (!tokenId) {
    return;
  }

  if (!socket || !socket.connected || !currentSessionId) {
    ensurePixiStage()
      .then((stage) => stage?.revertTokenMove(tokenId))
      .catch(() => {});
    return;
  }

  const payload = { tokenId, xCell, yCell };
  if (Number.isInteger(version) && version >= 0) {
    payload.version = version;
  }

  const rid = createRid();
  pendingTokenMoves.set(rid, {
    tokenId,
    xCell,
    yCell,
    version: payload.version ?? null,
    requestedAt: performance.now(),
  });

  const envelope = {
    type: 'token.move:in',
    rid,
    ts: Date.now(),
    payload,
  };

  socket.emit('message', envelope);
  logEvent('Запрошено перемещение жетона', payload);
}

function handleGmDragToggleChange(isActive) {
  const next = Boolean(isActive);
  if (gmDragMode === next) {
    return;
  }
  gmDragMode = next;
  updateStageMovePermissions().catch(() => {});
}

function updateDragToolAccess() {
  if (!dragTool) {
    return;
  }

  const canUse =
    currentRole === 'MASTER' &&
    Boolean(currentSessionId) &&
    Boolean(canvasState.activeSceneId) &&
    isConnected;

  let shouldUpdateStage = false;

  if (!canUse && gmDragMode) {
    gmDragMode = false;
    dragTool.setActive(false, { silent: true });
    shouldUpdateStage = true;
  }

  dragTool.setDisabled(!canUse);

  if (shouldUpdateStage) {
    updateStageMovePermissions().catch(() => {});
  }
}

function showCanvasOverlay({ title, text, showButton = false, buttonLabel = 'Загрузить активную' } = {}) {
  if (!boardOverlay) return;
  if (boardOverlayTitle && typeof title === 'string') {
    boardOverlayTitle.textContent = title;
  }
  if (boardOverlayText && typeof text === 'string') {
    boardOverlayText.textContent = text;
  }

  if (boardOverlayRetry) {
    boardOverlayRetry.textContent = buttonLabel ?? boardOverlayRetry.textContent;
    if (showButton) {
      boardOverlayRetry.removeAttribute('hidden');
      boardOverlayRetry.removeAttribute('disabled');
    } else {
      boardOverlayRetry.setAttribute('hidden', '');
    }
  }

  boardOverlay.classList.toggle('board__overlay--interactive', Boolean(showButton));
  boardOverlay.removeAttribute('hidden');
}

function hideCanvasOverlay() {
  if (!boardOverlay) return;
  boardOverlay.classList.remove('board__overlay--interactive');
  boardOverlay.setAttribute('hidden', '');
}

function setCanvasOverlayLoading(isLoading) {
  canvasState.isLoading = Boolean(isLoading);
  if (boardOverlayRetry) {
    if (!boardOverlayRetry.hasAttribute('hidden')) {
      boardOverlayRetry.toggleAttribute('disabled', canvasState.isLoading);
    }
  }
}

async function resetCanvasStage() {
  const stage = await ensurePixiStage();
  stage?.clear();
  canvasState.gridSize = null;
  tokenListState.tokens.clear();
  resetTokenOwnerAssignments();
  renderTokenList();
  updateTokenFormAccess();
  updateDragToolAccess();
}

function clearTokenStatusTimeout() {
  if (tokenToolsState.statusResetTimeoutId) {
    window.clearTimeout(tokenToolsState.statusResetTimeoutId);
    tokenToolsState.statusResetTimeoutId = null;
  }
}

function setTokenFormStatus(message, variant = 'idle', { autoReset = false } = {}) {
  if (!tokenStatusEl) return;

  clearTokenStatusTimeout();
  tokenToolsState.statusVariant = variant;
  tokenStatusEl.textContent = message;
  tokenStatusEl.classList.toggle('token-form__status--error', variant === 'error');
  tokenStatusEl.classList.toggle('token-form__status--success', variant === 'success');

  if (autoReset) {
    tokenToolsState.statusResetTimeoutId = window.setTimeout(() => {
      tokenToolsState.statusResetTimeoutId = null;
      if (tokenToolsState.isSubmitting) {
        return;
      }
      tokenToolsState.statusVariant = 'idle';
      if (tokenStatusEl) {
        tokenStatusEl.classList.remove('token-form__status--error', 'token-form__status--success');
        tokenStatusEl.textContent = 'Введите имя и координаты клетки.';
      }
    }, 3200);
  }
}

function resetTokenForm() {
  if (tokenNameInput) tokenNameInput.value = '';
  if (tokenXInput) tokenXInput.value = '';
  if (tokenYInput) tokenYInput.value = '';
}

function updateTokenFormAccess() {
  if (!tokenForm) return;

  const hasSession = Boolean(currentSessionId);
  const hasActiveScene = Boolean(canvasState.activeSceneId);
  const canSubmit = currentRole === 'MASTER' && isConnected && hasSession && hasActiveScene;
  const disableFields = !canSubmit || tokenToolsState.isSubmitting;

  [tokenNameInput, tokenXInput, tokenYInput].forEach((input) => {
    input?.toggleAttribute('disabled', disableFields);
  });
  tokenSubmitBtn?.toggleAttribute('disabled', disableFields);

  if (tokenToolsState.isSubmitting) {
    return;
  }

  if (!canSubmit) {
    if (currentRole !== 'MASTER') {
      setTokenFormStatus('Доступно только Мастеру.', 'idle');
    } else if (!isConnected) {
      setTokenFormStatus('Ожидаем соединение с сервером...', 'idle');
    } else if (!hasSession) {
      setTokenFormStatus('Создайте или загрузите сессию, чтобы добавлять жетоны.', 'idle');
    } else if (!hasActiveScene) {
      setTokenFormStatus('Сделайте сцену активной, чтобы добавлять жетоны.', 'idle');
    }
  } else if (tokenToolsState.statusVariant === 'idle') {
    setTokenFormStatus('Введите имя и координаты клетки.', 'idle');
  }
}

function initTokenTools() {
  if (!gmTokensToolsItem || tokenForm) {
    return;
  }

  tokenForm = document.createElement('form');
  tokenForm.className = 'token-form';
  tokenForm.autocomplete = 'off';

  const fields = document.createElement('div');
  fields.className = 'token-form__fields';

  const nameField = document.createElement('label');
  nameField.className = 'field token-form__field';
  const nameLabel = document.createElement('span');
  nameLabel.className = 'field__label';
  nameLabel.textContent = 'Имя жетона';
  tokenNameInput = document.createElement('input');
  tokenNameInput.type = 'text';
  tokenNameInput.required = true;
  tokenNameInput.placeholder = 'Например, Страж';
  tokenNameInput.className = 'field__input';
  tokenNameInput.autocomplete = 'off';
  nameField.append(nameLabel, tokenNameInput);

  const coordsRow = document.createElement('div');
  coordsRow.className = 'token-form__coordinates';

  const xField = document.createElement('label');
  xField.className = 'field token-form__field token-form__field--compact';
  const xLabel = document.createElement('span');
  xLabel.className = 'field__label';
  xLabel.textContent = 'Клетка X';
  tokenXInput = document.createElement('input');
  tokenXInput.type = 'number';
  tokenXInput.inputMode = 'numeric';
  tokenXInput.min = '0';
  tokenXInput.step = '1';
  tokenXInput.placeholder = '0';
  tokenXInput.className = 'field__input';
  xField.append(xLabel, tokenXInput);

  const yField = document.createElement('label');
  yField.className = 'field token-form__field token-form__field--compact';
  const yLabel = document.createElement('span');
  yLabel.className = 'field__label';
  yLabel.textContent = 'Клетка Y';
  tokenYInput = document.createElement('input');
  tokenYInput.type = 'number';
  tokenYInput.inputMode = 'numeric';
  tokenYInput.min = '0';
  tokenYInput.step = '1';
  tokenYInput.placeholder = '0';
  tokenYInput.className = 'field__input';
  yField.append(yLabel, tokenYInput);

  coordsRow.append(xField, yField);

  fields.append(nameField, coordsRow);

  tokenSubmitBtn = document.createElement('button');
  tokenSubmitBtn.type = 'submit';
  tokenSubmitBtn.className = 'btn btn--secondary token-form__submit';
  tokenSubmitBtn.textContent = 'Добавить жетон';

  tokenStatusEl = document.createElement('p');
  tokenStatusEl.className = 'token-form__status';
  tokenStatusEl.setAttribute('role', 'status');

  tokenForm.append(fields, tokenSubmitBtn, tokenStatusEl);
  gmTokensToolsItem.append(tokenForm);

  tokenListContainer = document.createElement('div');
  tokenListContainer.className = 'token-list';

  tokenListHeader = document.createElement('div');
  tokenListHeader.className = 'token-list__header';

  const nameHeader = document.createElement('span');
  nameHeader.className = 'token-list__column token-list__column--name';
  nameHeader.textContent = 'Жетон';

  const ownerHeader = document.createElement('span');
  ownerHeader.className = 'token-list__column token-list__column--owner';
  ownerHeader.textContent = 'Владелец';

  tokenListHeader.append(nameHeader, ownerHeader);

  tokenListBody = document.createElement('div');
  tokenListBody.className = 'token-list__body';
  tokenListBody.addEventListener('change', handleTokenOwnerChange);

  tokenListStatusEl = document.createElement('p');
  tokenListStatusEl.className = 'token-list__status';
  tokenListStatusEl.setAttribute('role', 'status');
  tokenListStatusEl.setAttribute('hidden', '');

  tokenListContainer.append(tokenListHeader, tokenListBody, tokenListStatusEl);
  gmTokensToolsItem.append(tokenListContainer);

  tokenForm.addEventListener('submit', handleTokenFormSubmit);

  setTokenFormStatus('Сделайте сцену активной, чтобы добавлять жетоны.', 'idle');
  updateTokenFormAccess();
  renderTokenList();
}

function handleTokenFormSubmit(event) {
  event?.preventDefault?.();
  if (!socket || !socket.connected) {
    setTokenFormStatus('Нет соединения с сервером.', 'error');
    return;
  }

  if (currentRole !== 'MASTER') {
    setTokenFormStatus('Только Мастер может добавлять жетоны.', 'error');
    return;
  }

  if (!currentSessionId) {
    setTokenFormStatus('Подключитесь к сессии, чтобы добавить жетон.', 'error');
    return;
  }

  if (!canvasState.activeSceneId) {
    setTokenFormStatus('Активная сцена не выбрана.', 'error');
    return;
  }

  const name = tokenNameInput?.value?.trim() ?? '';
  if (!name) {
    setTokenFormStatus('Введите имя жетона.', 'error');
    tokenNameInput?.focus?.();
    return;
  }

  const xCell = Number.parseInt(tokenXInput?.value ?? '', 10);
  if (!Number.isInteger(xCell) || xCell < 0) {
    setTokenFormStatus('Введите координату X (целое число).', 'error');
    tokenXInput?.focus?.();
    return;
  }

  const yCell = Number.parseInt(tokenYInput?.value ?? '', 10);
  if (!Number.isInteger(yCell) || yCell < 0) {
    setTokenFormStatus('Введите координату Y (целое число).', 'error');
    tokenYInput?.focus?.();
    return;
  }

  const rid = createRid();

  tokenToolsState.isSubmitting = true;
  tokenForm?.classList.add('token-form--busy');
  updateTokenFormAccess();
  setTokenFormStatus('Добавляем жетон на сцену...', 'idle');

  pendingTokenCreates.set(rid, {
    name,
    xCell,
    yCell,
    submittedAt: performance.now(),
  });

  const envelope = {
    type: 'token.create:in',
    rid,
    ts: Date.now(),
    payload: {
      sceneId: canvasState.activeSceneId,
      name,
      xCell,
      yCell,
    },
  };

  socket.emit('message', envelope);
  logEvent('Запрошено создание жетона', envelope.payload);
}

function formatSessionMemberLabel(member) {
  const username = member?.username ? String(member.username) : 'Без имени';
  const role = typeof member?.role === 'string' ? member.role.toUpperCase() : '';

  if (role === 'MASTER') {
    return `${username} (Мастер)`;
  }

  if (role === 'PLAYER') {
    return `${username} (Игрок)`;
  }

  return role ? `${username} (${role})` : username;
}

function resetTokenOwnerAssignments() {
  pendingOwnerAssignments.clear();
  ownerAssignmentByRid.clear();
}

function resetSessionMembersState() {
  sessionMembersState.members = [];
  sessionMembersState.isLoading = false;
  sessionMembersState.lastSessionId = null;
  sessionMembersState.error = null;
}

function upsertTokenInList(token) {
  if (!token || typeof token !== 'object' || !token.id) {
    return false;
  }

  const normalized = {
    ...token,
    ownerUserId: token.ownerUserId ?? null,
  };

  tokenListState.tokens.set(token.id, normalized);
  return true;
}

function handleTokenListSessionChange(previousSessionId, nextSessionId) {
  if (previousSessionId !== nextSessionId) {
    tokenListState.tokens.clear();
    resetTokenOwnerAssignments();
  }

  if (!nextSessionId) {
    resetSessionMembersState();
  }

  renderTokenList();
}

function renderTokenList() {
  if (!tokenListContainer) {
    return;
  }

  const isGM = currentRole === 'MASTER';
  const hasSession = Boolean(currentSessionId);
  const hasActiveScene = Boolean(canvasState.activeSceneId);

  const visibleTokens = [];
  if (tokenListState.tokens.size) {
    tokenListState.tokens.forEach((token) => {
      if (!hasActiveScene) {
        visibleTokens.push(token);
        return;
      }

      if (!token?.sceneId || token.sceneId === canvasState.activeSceneId) {
        visibleTokens.push(token);
      }
    });
  }

  if (tokenListBody) {
    tokenListBody.innerHTML = '';
  }

  if (tokenListHeader) {
    if (isGM && hasSession && hasActiveScene && visibleTokens.length) {
      tokenListHeader.removeAttribute('hidden');
    } else {
      tokenListHeader.setAttribute('hidden', '');
    }
  }

  if (isGM && hasSession && hasActiveScene && visibleTokens.length && tokenListBody) {
    const members = sessionMembersState.members;

    const sortedTokens = visibleTokens
      .map((token) => ({
        ...token,
        name: typeof token.name === 'string' ? token.name : '',
        ownerUserId: token.ownerUserId ?? null,
      }))
      .sort((a, b) => {
        const nameA = a.name.toLocaleLowerCase();
        const nameB = b.name.toLocaleLowerCase();

        if (nameA && nameB) {
          const byName = nameA.localeCompare(nameB);
          if (byName !== 0) {
            return byName;
          }
        } else if (nameA) {
          return -1;
        } else if (nameB) {
          return 1;
        }

        return (a.id ?? '').localeCompare(b.id ?? '');
      });

    sortedTokens.forEach((token) => {
      const row = document.createElement('div');
      row.className = 'token-list__row';

      const pendingAssignment = pendingOwnerAssignments.get(token.id);
      if (pendingAssignment) {
        row.classList.add('token-list__row--pending');
      }

      const nameEl = document.createElement('div');
      nameEl.className = 'token-list__name';
      nameEl.textContent = token.name || 'Без названия';

      const ownerWrapper = document.createElement('div');
      ownerWrapper.className = 'token-list__owner';

      const select = document.createElement('select');
      select.className = 'token-list__select';
      select.dataset.tokenId = token.id ?? '';

      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = '— Без владельца —';
      select.append(defaultOption);

      members.forEach((member) => {
        const option = document.createElement('option');
        option.value = member.userId ?? '';
        option.textContent = formatSessionMemberLabel(member);
        select.append(option);
      });

      const ownerValueRaw =
        pendingAssignment && pendingAssignment.ownerUserId !== undefined
          ? pendingAssignment.ownerUserId
          : token.ownerUserId;
      const ownerValue = ownerValueRaw ? String(ownerValueRaw) : '';

      if (
        ownerValue &&
        !members.some((member) => member.userId === ownerValue)
      ) {
        const placeholderOption = document.createElement('option');
        placeholderOption.value = ownerValue;
        placeholderOption.textContent = 'Не в сессии';
        select.append(placeholderOption);
      }

      select.value = ownerValue;
      const shouldDisable =
        !isConnected ||
        !hasSession ||
        !hasActiveScene ||
        sessionMembersState.isLoading ||
        Boolean(pendingAssignment);
      select.toggleAttribute('disabled', shouldDisable);

      ownerWrapper.append(select);
      row.append(nameEl, ownerWrapper);
      tokenListBody.append(row);
    });
  }

  if (tokenListStatusEl) {
    let statusText = '';
    let statusVariant = 'info';

    if (!isGM) {
      statusText = 'Доступно только Мастеру.';
    } else if (!hasSession) {
      statusText = 'Создайте или загрузите сессию, чтобы назначать владельцев.';
    } else if (!isConnected) {
      statusText = 'Ожидаем соединение с сервером…';
    } else if (!hasActiveScene) {
      statusText = 'Сделайте сцену активной, чтобы назначать владельцев.';
    } else if (!visibleTokens.length) {
      statusText = 'На активной сцене пока нет жетонов.';
    } else if (sessionMembersState.isLoading) {
      statusText = 'Загружаем список участников…';
    } else if (sessionMembersState.error) {
      statusText = sessionMembersState.error;
      statusVariant = 'error';
    } else if (!sessionMembersState.members.length) {
      statusText = 'Игроки ещё не присоединились.';
    }

    if (statusText) {
      tokenListStatusEl.textContent = statusText;
      tokenListStatusEl.classList.toggle('token-list__status--error', statusVariant === 'error');
      tokenListStatusEl.removeAttribute('hidden');
    } else {
      tokenListStatusEl.classList.remove('token-list__status--error');
      tokenListStatusEl.setAttribute('hidden', '');
      tokenListStatusEl.textContent = '';
    }
  }
}

function assignOwner(tokenId, ownerUserId) {
  if (!tokenId) {
    return;
  }

  if (currentRole !== 'MASTER') {
    logEvent('Назначение владельца доступно только Мастеру');
    renderTokenList();
    return;
  }

  if (!socket || !socket.connected) {
    logEvent('Нет соединения с сервером для назначения владельца');
    renderTokenList();
    return;
  }

  if (!currentSessionId) {
    logEvent('Сессия не выбрана для назначения владельца');
    renderTokenList();
    return;
  }

  const normalizedOwner = ownerUserId ? String(ownerUserId).trim() : null;

  const payload = { tokenId };
  if (normalizedOwner) {
    payload.ownerUserId = normalizedOwner;
  } else {
    payload.ownerUserId = null;
  }

  const rid = createRid();
  pendingOwnerAssignments.set(tokenId, { rid, ownerUserId: normalizedOwner });
  ownerAssignmentByRid.set(rid, tokenId);

  renderTokenList();

  const envelope = {
    type: 'token.assignOwner:in',
    rid,
    ts: Date.now(),
    payload,
  };

  socket.emit('message', envelope);
  logEvent('Запрошено назначение владельца жетона', {
    tokenId,
    ownerUserId: normalizedOwner,
  });
}

function handleTokenOwnerChange(event) {
  const target = event?.target;
  if (!target || !target.classList?.contains('token-list__select')) {
    return;
  }

  const tokenId = target.dataset?.tokenId ?? '';
  if (!tokenId) {
    return;
  }

  const selectedValue = target.value;
  const nextOwner = selectedValue ? selectedValue : null;

  const existing = tokenListState.tokens.get(tokenId);
  const currentOwner = existing?.ownerUserId ?? null;

  if ((currentOwner ?? null) === (nextOwner ?? null)) {
    return;
  }

  assignOwner(tokenId, nextOwner);
}

async function refreshSessionMembers({ force = false, silent = false } = {}) {
  const sessionId = currentSessionId;
  const token = getStoredToken();

  if (!sessionId || currentRole !== 'MASTER' || !token) {
    resetSessionMembersState();
    renderTokenList();
    return [];
  }

  if (sessionMembersState.isLoading && !force) {
    return sessionMembersState.members;
  }

  if (
    !force &&
    sessionMembersState.lastSessionId === sessionId &&
    sessionMembersState.members.length > 0 &&
    !sessionMembersState.error
  ) {
    return sessionMembersState.members;
  }

  sessionMembersState.isLoading = true;
  sessionMembersState.error = null;
  renderTokenList();

  try {
    const res = await fetch(`/api/sessions/${sessionId}/members`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      const message = payload?.error ?? 'Не удалось получить список участников';
      throw new Error(message);
    }

    const payload = await res.json().catch(() => ({}));
    const members = Array.isArray(payload?.members) ? payload.members : [];

    sessionMembersState.members = members
      .map((member) => ({
        userId: member?.userId ? String(member.userId) : null,
        username: member?.username ?? '',
        role: member?.role ?? 'PLAYER',
      }))
      .filter((member) => Boolean(member.userId));
    sessionMembersState.lastSessionId = sessionId;
    sessionMembersState.error = null;

    if (!silent) {
      logEvent('Список участников обновлён', {
        sessionId,
        count: sessionMembersState.members.length,
      });
    }

    return sessionMembersState.members;
  } catch (err) {
    sessionMembersState.members = [];
    sessionMembersState.error = err?.message ?? 'Не удалось получить список участников';
    sessionMembersState.lastSessionId = null;
    if (!silent) {
      logEvent('Не удалось получить список участников', sessionMembersState.error);
    }
    return [];
  } finally {
    sessionMembersState.isLoading = false;
    renderTokenList();
  }
}

function handleTokenCreateSuccess(token, rid) {
  const isOwnRequest = rid ? pendingTokenCreates.has(rid) : false;

  if (isOwnRequest) {
    pendingTokenCreates.delete(rid);
    tokenToolsState.isSubmitting = false;
    tokenForm?.classList.remove('token-form--busy');
    updateTokenFormAccess();
    resetTokenForm();
    tokenNameInput?.focus?.();
    setTokenFormStatus('Жетон добавлен на сцену.', 'success', { autoReset: true });
  }

  if (token) {
    logEvent('Жетон размещён', {
      name: token.name ?? null,
      xCell: token.xCell,
      yCell: token.yCell,
      sceneId: token.sceneId ?? null,
      source: isOwnRequest ? 'self' : 'remote',
    });
  }
}

function handleTokenCreateError(errorMessage, rid) {
  const isOwnRequest = rid ? pendingTokenCreates.has(rid) : false;

  if (isOwnRequest) {
    pendingTokenCreates.delete(rid);
    tokenToolsState.isSubmitting = false;
    tokenForm?.classList.remove('token-form--busy');
    updateTokenFormAccess();
    setTokenFormStatus(errorMessage || 'Не удалось создать жетон.', 'error');
  }

  logEvent('Ошибка создания жетона', errorMessage || 'Не удалось создать жетон.');
}

async function applySceneSnapshot({
  sceneId,
  snapshot,
  stage: providedStage = null,
  reason = 'manual',
  logMessage = 'Снимок сцены обновлён',
}) {
  const stage = providedStage ?? (await ensurePixiStage());
  if (!stage) {
    return false;
  }

  if (!snapshot || !snapshot.scene) {
    tokenListState.tokens.clear();
    resetTokenOwnerAssignments();
    renderTokenList();
    return false;
  }

  await stage.loadSnapshot(snapshot);
  canvasState.activeSceneId = sceneId ?? snapshot.scene?.id ?? null;
  canvasState.gridSize = snapshot?.scene?.gridSize ?? stage.tokensLayer?.getGridSize?.() ?? null;
  tokenListState.tokens.clear();
  resetTokenOwnerAssignments();
  if (Array.isArray(snapshot.tokens)) {
    snapshot.tokens.forEach((token) => {
      upsertTokenInList(token);
    });
  }
  renderTokenList();
  updateTokenFormAccess();
  hideCanvasOverlay();
  logEvent(logMessage, { sceneId: canvasState.activeSceneId, reason });
  updateStageMovePermissions().catch(() => {});
  updateDragToolAccess();
  return true;
}

async function loadActiveSceneSnapshot({ reason = 'manual', silent = false } = {}) {
  if (canvasState.isLoading) {
    return { loading: true };
  }

  canvasState.isLoading = true;
  showBoardLoadingOverlay();

  let stage = null;

  try {
    stage = await ensurePixiStage();
    if (!stage) {
      return { loaded: false };
    }

    const token = getStoredToken();
    if (!currentSessionId || !token) {
      await stage.clear();
      canvasState.activeSceneId = null;
      canvasState.gridSize = null;
      tokenListState.tokens.clear();
      resetTokenOwnerAssignments();
      renderTokenList();
      updateTokenFormAccess();
      if (!currentSessionId) {
        showCanvasOverlay({
          title: 'Сцена не выбрана',
          text: 'Подключитесь к сессии, чтобы увидеть активную сцену.',
          showButton: false,
        });
      } else {
        showCanvasOverlay({
          title: 'Нет доступа',
          text: 'Войдите, чтобы загрузить активную сцену.',
          showButton: false,
        });
      }
      return { loaded: false };
    }

    setCanvasOverlayLoading(true);
    showCanvasOverlay({
      title: 'Загружаем сцену…',
      text: 'Запрашиваем активную сцену у сервера.',
      showButton: false,
    });

    const res = await fetch(`/api/sessions/${currentSessionId}/active-scene`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = payload?.error ?? 'Не удалось получить активную сцену';
      await stage.clear();
      canvasState.activeSceneId = null;
      canvasState.gridSize = null;
      tokenListState.tokens.clear();
      resetTokenOwnerAssignments();
      renderTokenList();
      updateTokenFormAccess();
      showCanvasOverlay({
        title: 'Не удалось загрузить сцену',
        text: message,
        showButton: true,
        buttonLabel: 'Повторить попытку',
      });
      if (!silent) {
        logEvent('Ошибка запроса активной сцены', { sessionId: currentSessionId, message });
      }
      return { loaded: false, error: message };
    }

    const activeSceneId = payload?.activeSceneId ?? null;
    canvasState.activeSceneId = activeSceneId;

    if (!activeSceneId) {
      await stage.clear();
      showCanvasOverlay({
        title: 'Сцена не выбрана',
        text: 'Сделайте сцену активной или повторите попытку позже.',
        showButton: true,
        buttonLabel: 'Загрузить активную',
      });
      canvasState.gridSize = null;
      tokenListState.tokens.clear();
      resetTokenOwnerAssignments();
      renderTokenList();
      updateTokenFormAccess();
      if (!silent) {
        logEvent('Активная сцена не назначена', { sessionId: currentSessionId });
      }
      return { loaded: false };
    }

    const query = currentSessionId ? `?sessionId=${encodeURIComponent(currentSessionId)}` : '';
    const snapshotRes = await fetch(`/api/scenes/${activeSceneId}/snapshot${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const snapshot = await snapshotRes.json().catch(() => ({}));

    if (!snapshotRes.ok || !snapshot?.scene) {
      const message = snapshot?.error ?? 'Не удалось загрузить снапшот сцены';
      await stage.clear();
      canvasState.gridSize = null;
      tokenListState.tokens.clear();
      resetTokenOwnerAssignments();
      renderTokenList();
      updateTokenFormAccess();
      showCanvasOverlay({
        title: 'Не удалось загрузить сцену',
        text: message,
        showButton: true,
        buttonLabel: 'Повторить попытку',
      });
      if (!silent) {
        logEvent('Ошибка загрузки снапшота сцены', { sceneId: activeSceneId, message });
      }
      return { loaded: false, error: message };
    }

    const applied = await applySceneSnapshot({
      sceneId: activeSceneId,
      snapshot,
      stage,
      reason,
      logMessage: 'Снимок сцены загружен',
    });
    if (applied) {
      hasReceivedInitialSnapshot = true;
    }
    return { loaded: applied, sceneId: activeSceneId };
  } catch (err) {
    await stage?.clear?.();
    const message = err?.message ?? String(err);
    tokenListState.tokens.clear();
    resetTokenOwnerAssignments();
    renderTokenList();
    canvasState.gridSize = null;
    updateTokenFormAccess();
    showCanvasOverlay({
      title: 'Не удалось загрузить сцену',
      text: 'Проверьте соединение и попробуйте снова.',
      showButton: true,
      buttonLabel: 'Повторить попытку',
    });
    if (!silent) {
      logEvent('Ошибка загрузки активной сцены', message);
    }
    return { loaded: false, error: message };
  } finally {
    canvasState.isLoading = false;
    setCanvasOverlayLoading(false);
    hideBoardLoadingOverlay();
    updateDragToolAccess();
  }
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

function setSceneFormStatus(message, variant = 'idle') {
  if (!createSceneStatus) return;
  if (typeof message === 'string') {
    createSceneStatus.textContent = message;
  }

  createSceneStatus.classList.remove('scene-form__status--error', 'scene-form__status--success');
  if (variant === 'error') {
    createSceneStatus.classList.add('scene-form__status--error');
  } else if (variant === 'success') {
    createSceneStatus.classList.add('scene-form__status--success');
  }

  sceneFormState.statusVariant = variant;
}

function resetSceneFormResult() {
  sceneFormState.lastSceneId = null;
  sceneFormState.lastSceneName = '';
  sceneFormState.activeSceneId = null;
  if (createSceneResult) {
    createSceneResult.setAttribute('hidden', '');
  }
  if (createSceneResultName) {
    createSceneResultName.textContent = '';
  }
  if (createSceneResultText) {
    createSceneResultText.textContent = '';
  }
  createSceneResultBadge?.setAttribute('hidden', '');
  syncSceneResultControls();
}

function syncSceneResultControls() {
  if (createSceneResult) {
    if (sceneFormState.lastSceneId) createSceneResult.removeAttribute('hidden');
    else createSceneResult.setAttribute('hidden', '');
  }

  const isActive = Boolean(
    sceneFormState.lastSceneId && sceneFormState.activeSceneId === sceneFormState.lastSceneId,
  );

  if (createSceneResultBadge) {
    if (isActive) createSceneResultBadge.removeAttribute('hidden');
    else createSceneResultBadge.setAttribute('hidden', '');
  }

  if (makeActiveSceneBtn) {
    const disabled =
      !sceneFormState.lastSceneId ||
      sceneFormState.isActivating ||
      isActive ||
      currentRole !== 'MASTER' ||
      !currentSessionId ||
      !isConnected;
    makeActiveSceneBtn.toggleAttribute('disabled', disabled);
  }
}

function updateSceneFormAccess() {
  const isMaster = currentRole === 'MASTER';
  const hasSession = Boolean(currentSessionId);
  const connected = isConnected;
  const disableInputs =
    !isMaster || !hasSession || !connected || sceneFormState.isSubmitting || sceneFormState.isActivating;

  [sceneNameInput, sceneGridInput, sceneWidthInput, sceneHeightInput].forEach((input) => {
    if (!input) return;
    if (disableInputs) input.setAttribute('disabled', '');
    else input.removeAttribute('disabled');
  });

  if (createSceneSubmitBtn) {
    if (disableInputs) createSceneSubmitBtn.setAttribute('disabled', '');
    else createSceneSubmitBtn.removeAttribute('disabled');
  }

  if (!isMaster) {
    setSceneFormStatus('Доступно только Мастеру.', 'idle');
  } else if (!hasSession) {
    setSceneFormStatus('Создайте или загрузите сессию, чтобы подготовить сцену.', 'idle');
  } else if (!connected) {
    setSceneFormStatus('Ожидаем соединение с сервером...', 'idle');
  } else if (sceneFormState.statusVariant !== 'success' && sceneFormState.statusVariant !== 'error') {
    setSceneFormStatus('Заполните параметры и создайте новую сцену.', 'idle');
  }

  syncSceneResultControls();
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

function handleScenePanelSessionChange(previousSessionId, nextSessionId) {
  if (previousSessionId !== nextSessionId) {
    resetSceneFormResult();
    if (nextSessionId) {
      setSceneFormStatus('Заполните параметры и создайте новую сцену.', 'idle');
    } else {
      setSceneFormStatus('Создайте или загрузите сессию, чтобы подготовить сцену.', 'idle');
    }
  }

  updateSceneFormAccess();
}

function handleCanvasSessionChange(previousSessionId, nextSessionId) {
  if (previousSessionId === nextSessionId) {
    return;
  }

  canvasState.activeSceneId = null;
  canvasState.gridSize = null;
  pendingTokenMoves.clear();
  resetCanvasStage();

  if (!nextSessionId) {
    showCanvasOverlay({
      title: 'Сцена не выбрана',
      text: 'Создайте или загрузите сессию, чтобы увидеть сцену.',
      showButton: false,
    });
  } else {
    showCanvasOverlay({
      title: 'Сцена не выбрана',
      text: 'Сделайте сцену активной или загрузите текущее состояние.',
      showButton: true,
    });
  }

  updateTokenFormAccess();
  renderTokenList();
}

async function setActiveScene(sceneId, { silent = false } = {}) {
  if (!sceneId) {
    if (!silent) {
      setSceneFormStatus('Не выбрана сцена для активации.', 'error');
    }
    return false;
  }

  const token = getStoredToken();
  if (!token) {
    if (!silent) {
      setSceneFormStatus('Необходимо войти как Мастер.', 'error');
    }
    return false;
  }

  if (!currentSessionId) {
    if (!silent) {
      setSceneFormStatus('Создайте или загрузите сессию, чтобы подготовить сцену.', 'error');
    }
    return false;
  }

  const normalizedSceneId = String(sceneId);
  sceneFormState.isActivating = true;
  syncSceneResultControls();

  try {
    const res = await fetch(`/api/sessions/${currentSessionId}/active-scene`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sceneId: normalizedSceneId }),
    });

    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message =
        payload?.error?.message ?? payload?.error ?? 'Не удалось обновить активную сцену';
      if (!silent) {
        setSceneFormStatus(message, 'error');
      }
      logEvent('Не удалось обновить активную сцену', message);
      return false;
    }

    const activeSceneId = payload?.activeSceneId ?? null;
    sceneFormState.activeSceneId = activeSceneId;
    syncSceneResultControls();

    if (!silent) {
      if (activeSceneId === normalizedSceneId) {
        setSceneFormStatus('Сцена сделана активной.', 'success');
      } else {
        setSceneFormStatus('Активная сцена обновлена.', 'success');
      }
    }

    logEvent('Активная сцена обновлена', {
      sessionId: currentSessionId,
      sceneId: activeSceneId,
    });

    loadActiveSceneSnapshot({ reason: 'activation', silent: true });

    return activeSceneId === normalizedSceneId;
  } catch (err) {
    if (!silent) {
      setSceneFormStatus('Не удалось обновить активную сцену', 'error');
    }
    logEvent('Ошибка при обновлении активной сцены', err?.message ?? String(err));
    return false;
  } finally {
    sceneFormState.isActivating = false;
    syncSceneResultControls();
    updateSceneFormAccess();
  }
}

async function submitSceneCreation(event) {
  event?.preventDefault?.();
  if (!createSceneForm || sceneFormState.isSubmitting) return;

  const token = getStoredToken();
  if (!token) {
    setSceneFormStatus('Необходимо войти как Мастер.', 'error');
    return;
  }

  if (!currentSessionId) {
    setSceneFormStatus('Создайте или загрузите сессию, чтобы подготовить сцену.', 'error');
    return;
  }

  const name = sceneNameInput?.value?.trim() ?? '';
  if (!name) {
    setSceneFormStatus('Введите название сцены.', 'error');
    sceneNameInput?.focus();
    return;
  }

  const gridSize = Number.parseInt(sceneGridInput?.value ?? '', 10);
  const widthPx = Number.parseInt(sceneWidthInput?.value ?? '', 10);
  const heightPx = Number.parseInt(sceneHeightInput?.value ?? '', 10);

  sceneFormState.isSubmitting = true;
  updateSceneFormAccess();
  setSceneFormStatus('Создаём сцену...', 'idle');

  try {
    const res = await fetch(`/api/sessions/${currentSessionId}/scenes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, gridSize, widthPx, heightPx }),
    });

    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = payload?.error?.message ?? payload?.error ?? 'Не удалось создать сцену';
      setSceneFormStatus(message, 'error');
      logEvent('Ошибка создания сцены', message);
      return;
    }

    const scene = payload?.scene;
    if (!scene?.id) {
      setSceneFormStatus('Некорректный ответ сервера', 'error');
      logEvent('Некорректный ответ при создании сцены', payload);
      return;
    }

    sceneFormState.lastSceneId = scene.id;
    sceneFormState.lastSceneName = scene.name ?? 'Новая сцена';
    if (createSceneResultName) {
      createSceneResultName.textContent = sceneFormState.lastSceneName;
    }
    syncSceneResultControls();

    const activated = await setActiveScene(scene.id, { silent: true });

    if (activated) {
      if (createSceneResultText) {
        createSceneResultText.textContent = 'Сцена создана и активирована.';
      }
      setSceneFormStatus('Сцена создана и активирована.', 'success');
    } else {
      if (createSceneResultText) {
        createSceneResultText.textContent = 'Сцена создана. Сделайте её активной, когда будете готовы.';
      }
      if (sceneFormState.statusVariant !== 'error') {
        setSceneFormStatus('Сцена создана. Сделайте её активной, когда будете готовы.', 'idle');
      }
    }

    sceneNameInput?.focus();
    sceneNameInput?.select?.();
    if (sceneNameInput) {
      sceneNameInput.value = '';
    }

    logEvent('Сцена создана', {
      sessionId: currentSessionId,
      sceneId: scene.id,
      name: scene.name,
      activated: activated ? 'auto' : 'pending',
    });
  } catch (err) {
    setSceneFormStatus('Не удалось создать сцену', 'error');
    logEvent('Ошибка создания сцены', err?.message ?? String(err));
  } finally {
    sceneFormState.isSubmitting = false;
    updateSceneFormAccess();
  }
}

async function handleMakeActiveScene() {
  if (!sceneFormState.lastSceneId) {
    setSceneFormStatus('Нет сцены для активации.', 'error');
    return;
  }

  const activated = await setActiveScene(sceneFormState.lastSceneId);
  if (activated && createSceneResultText) {
    createSceneResultText.textContent = 'Сцена готова и отмечена как активная.';
  }
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
  const sessionId = currentSessionId;
  const previousRole = currentRole;
  const previousCode = currentSessionCode;
  const token = getStoredToken();

  if (!sessionId && !token) return;

  if (sessionId && token) {
    try {
      await fetch(`/api/sessions/${sessionId}/members/me`, {
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
  selectSessionSave(null);
  refreshSessionSaves({ force: true, silent: true });
  sessionSavesModal?.close();
  setSocketAuth();
  updateRole('GUEST');

  if (socket?.connected) {
    sendHandshake({ sessionId: null });
    socket.disconnect();
  } else {
    updateSessionControls();
    syncVisibility();
  }

  if (joinModal && previousRole !== 'MASTER') {
    joinModal.reset?.();
    if (previousCode) {
      joinModal.setValues({ code: previousCode });
    }
    joinModal.open();
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
  updateSceneFormAccess();
  updateTokenFormAccess();
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
  if (currentSessionId !== previousSessionId) {
    hasReceivedInitialSnapshot = false;
  }
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
  handleScenePanelSessionChange(previousSessionId, currentSessionId);
  handleCanvasSessionChange(previousSessionId, currentSessionId);
  handleTokenListSessionChange(previousSessionId, currentSessionId);
  if (currentRole === 'MASTER' && currentSessionId) {
    const shouldForce =
      sessionMembersState.lastSessionId !== currentSessionId ||
      sessionMembersState.members.length === 0;
    if (shouldForce) {
      refreshSessionMembers({ force: true, silent: true });
    }
  } else if (!currentSessionId) {
    resetSessionMembersState();
    renderTokenList();
  }
  updateStageMovePermissions().catch(() => {});
  renderTokenList();
  updateDragToolAccess();
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
  renderTokenList();
  updateDragToolAccess();
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
    resetSceneFormResult();
    setSceneFormStatus('Доступно только Мастеру.', 'idle');
    resetSessionMembersState();
    resetTokenOwnerAssignments();
  } else if (currentSessionId) {
    refreshSessionMembers({ force: true, silent: true });
  }
  updateSessionControls();
  syncVisibility();
  renderTokenList();
  updateStageMovePermissions().catch(() => {});
  updateDragToolAccess();
}

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

function buildInviteLink(sessionCode) {
  if (!sessionCode) {
    return window.location.href;
  }

  const normalizedCode = String(sessionCode).toUpperCase();
  const inviteUrl = new URL(window.location.href);
  inviteUrl.search = '';
  inviteUrl.hash = '';
  inviteUrl.searchParams.set('join', normalizedCode);
  return inviteUrl.toString();
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
    const inviteUrl = buildInviteLink(currentSessionCode);
    await copyText(inviteUrl);
    logEvent('Ссылка-приглашение скопирована', inviteUrl);
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

if (gmDragToggle) {
  dragTool = new DragTool({ button: gmDragToggle, onChange: handleGmDragToggleChange });
  dragTool.setDisabled(true);
}

updateDragToolAccess();

initTokenTools();

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
createSceneForm?.addEventListener('submit', submitSceneCreation);
makeActiveSceneBtn?.addEventListener('click', handleMakeActiveScene);
boardOverlayRetry?.addEventListener('click', () => {
  loadActiveSceneSnapshot({ reason: 'manual-retry' });
});
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
const inviteCodeParam = urlParams.get('join') ?? urlParams.get('code');
if (inviteCodeParam) {
  const normalizedInvite = inviteCodeParam.toUpperCase().slice(0, 6);
  joinModal.setValues({ code: normalizedInvite });
  if (!getStoredToken()) {
    joinModal.open();
  }
  urlParams.delete('join');
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
  pendingTokenCreates.clear();
  pendingTokenMoves.clear();
  hasReceivedInitialSnapshot = false;
  currentUserId = null;
  tokenToolsState.isSubmitting = false;
  tokenForm?.classList.remove('token-form--busy');
  updateTokenFormAccess();
  if (tokenStatusEl) {
    clearTokenStatusTimeout();
    setTokenFormStatus('Нет соединения с сервером.', 'error');
  }
  resetTokenOwnerAssignments();
  resetSessionMembersState();
  renderTokenList();
  gmDragMode = false;
  if (dragTool) {
    dragTool.setActive(false, { silent: true });
    dragTool.setDisabled(true);
  }
  updateStageMovePermissions().catch(() => {});
  updateDragToolAccess();
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
      currentUserId = payload?.userId ? String(payload.userId) : null;

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

      if (currentSessionId && getStoredToken() && !hasReceivedInitialSnapshot) {
        loadActiveSceneSnapshot({ reason: 'handshake', silent: true });
      }
      updateStageMovePermissions().catch(() => {});
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
    case 'scene.snapshot:out': {
      const payloadSessionId = payload?.sessionId ?? null;
      if (payloadSessionId && currentSessionId && payloadSessionId !== currentSessionId) {
        logEvent('Получен снапшот для другой сессии', {
          payloadSessionId,
          currentSessionId,
        });
        break;
      }

      if (payloadSessionId && !currentSessionId) {
        setSessionId(payloadSessionId, { persist: false, syncAuth: false });
      }

      hasReceivedInitialSnapshot = true;
      canvasState.isLoading = false;
      setCanvasOverlayLoading(false);

      const snapshot = payload?.snapshot ?? null;
      const sceneId = payload?.sceneId ?? snapshot?.scene?.id ?? null;
      const reason = payload?.reason ?? 'ws';

      if (!sceneId) {
        ensurePixiStage()
          .then((stage) => stage?.clear?.())
          .catch(() => {});
        canvasState.activeSceneId = null;
        canvasState.gridSize = null;
        updateTokenFormAccess();
        showCanvasOverlay({
          title: 'Сцена не выбрана',
          text: 'Сделайте сцену активной или повторите попытку позже.',
          showButton: true,
          buttonLabel: 'Загрузить активную',
        });
        logEvent('Активная сцена не назначена', {
          sessionId: payloadSessionId ?? currentSessionId ?? null,
          reason,
        });
        break;
      }

      if (!snapshot || !snapshot.scene) {
        ensurePixiStage()
          .then((stage) => stage?.clear?.())
          .catch(() => {});
        canvasState.activeSceneId = null;
        canvasState.gridSize = null;
        updateTokenFormAccess();
        showCanvasOverlay({
          title: 'Не удалось загрузить сцену',
          text: 'Снимок сцены недоступен. Попробуйте обновить позже.',
          showButton: true,
          buttonLabel: 'Повторить попытку',
        });
        logEvent('Не удалось получить снапшот сцены', {
          sceneId,
          reason,
        });
        break;
      }

      applySceneSnapshot({
        sceneId,
        snapshot,
        reason,
        logMessage: 'Снимок сцены синхронизирован',
      }).catch((err) => {
        logEvent('Не удалось применить снапшот сцены', err?.message ?? String(err));
      });
      break;
    }
    case 'token.create:out': {
      const token = payload?.token ?? null;
      const isOwn = rid ? pendingTokenCreates.has(rid) : false;

      if (token?.sceneId && canvasState.activeSceneId && token.sceneId !== canvasState.activeSceneId) {
        logEvent('Получен жетон для другой сцены', {
          tokenSceneId: token.sceneId,
          activeSceneId: canvasState.activeSceneId,
        });
        if (isOwn) {
          handleTokenCreateSuccess(token, rid);
        }
        break;
      }

      ensurePixiStage()
        .then((stage) => {
          if (!stage || !token) {
            return;
          }
          stage.addToken(token, { highlight: true });
        })
        .catch(() => {});

      if (
        token?.id &&
        (!token.sceneId || !canvasState.activeSceneId || token.sceneId === canvasState.activeSceneId)
      ) {
        upsertTokenInList(token);
        renderTokenList();
      }

      handleTokenCreateSuccess(token, rid);
      break;
    }
    case 'token.create:error': {
      const message = payload?.error ?? 'Не удалось создать жетон.';
      handleTokenCreateError(message, rid);
      break;
    }
    case 'token.move:out': {
      const tokenId = payload?.tokenId ?? null;
      const parsedX = Number.parseInt(payload?.xCell ?? '', 10);
      const parsedY = Number.parseInt(payload?.yCell ?? '', 10);
      const xCell = Number.isInteger(parsedX) ? parsedX : null;
      const yCell = Number.isInteger(parsedY) ? parsedY : null;
      const version = Number.isInteger(payload?.version) ? payload.version : undefined;
      const updatedAt = payload?.updatedAt ?? null;
      const isOwn = rid ? pendingTokenMoves.has(rid) : false;
      const sceneId = payload?.sceneId ?? null;

      if (isOwn) {
        pendingTokenMoves.delete(rid);
      }

      if (sceneId && canvasState.activeSceneId && sceneId !== canvasState.activeSceneId) {
        logEvent('Получено перемещение жетона для другой сцены', { sceneId, activeSceneId: canvasState.activeSceneId, tokenId });
        break;
      }

      const existingToken = tokenId ? tokenListState.tokens.get(tokenId) : null;
      if (existingToken) {
        tokenListState.tokens.set(tokenId, {
          ...existingToken,
          xCell: Number.isInteger(xCell) ? xCell : existingToken.xCell,
          yCell: Number.isInteger(yCell) ? yCell : existingToken.yCell,
          version: Number.isInteger(version) ? version : existingToken.version,
          updatedAt: updatedAt ?? existingToken.updatedAt ?? null,
        });
      }

      ensurePixiStage()
        .then((stage) => {
          if (!stage || !tokenId || !Number.isInteger(xCell) || !Number.isInteger(yCell)) {
            return;
          }
          stage.applyTokenMove({ tokenId, xCell, yCell, version, updatedAt });
        })
        .catch(() => {});

      logEvent(isOwn ? 'Перемещение жетона подтверждено' : 'Жетон перемещён', {
        tokenId,
        xCell,
        yCell,
        sceneId,
        source: isOwn ? 'self' : 'remote',
      });
      break;
    }
    case 'token.move:error': {
      const message = payload?.error ?? 'Не удалось переместить жетон.';
      const entry = rid ? pendingTokenMoves.get(rid) : null;

      if (entry) {
        pendingTokenMoves.delete(rid);
        ensurePixiStage()
          .then((stage) => stage?.revertTokenMove(entry.tokenId))
          .catch(() => {});
      }

      logEvent('Ошибка перемещения жетона', message);
      break;
    }
    case 'token.assignOwner:out': {
      const token = payload?.token ?? null;
      let tokenId = token?.id ?? null;
      const mappedTokenId = rid ? ownerAssignmentByRid.get(rid) : null;

      if (rid) {
        ownerAssignmentByRid.delete(rid);
      }

      if (mappedTokenId) {
        pendingOwnerAssignments.delete(mappedTokenId);
        if (!tokenId) {
          tokenId = mappedTokenId;
        }
      }

      if (token?.id) {
        if (
          !token.sceneId ||
          !canvasState.activeSceneId ||
          token.sceneId === canvasState.activeSceneId
        ) {
          upsertTokenInList(token);
          ensurePixiStage()
            .then((stage) => stage?.addToken(token))
            .catch(() => {});
        }
      }

      renderTokenList();

      const isOwn = Boolean(mappedTokenId);
      logEvent(isOwn ? 'Назначение владельца подтверждено' : 'Владелец жетона обновлён', {
        tokenId: tokenId ?? null,
        ownerUserId: token?.ownerUserId ?? null,
        sceneId: token?.sceneId ?? null,
        source: isOwn ? 'self' : 'remote',
      });
      updateStageMovePermissions().catch(() => {});
      break;
    }
    case 'token.assignOwner:error': {
      const message = payload?.error ?? 'Не удалось назначить владельца жетона.';
      const mappedTokenId = rid ? ownerAssignmentByRid.get(rid) : null;
      if (rid) {
        ownerAssignmentByRid.delete(rid);
      }

      const tokenId = mappedTokenId ?? payload?.tokenId ?? null;
      if (tokenId) {
        pendingOwnerAssignments.delete(tokenId);
      }

      renderTokenList();
      logEvent('Ошибка назначения владельца жетона', message);
      break;
    }
    default:
      logEvent(`Получен конверт: ${type}`, envelope);
  }
});

setStatus('OFFLINE');
syncVisibility();
