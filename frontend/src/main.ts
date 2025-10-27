import { io, type Socket } from "socket.io-client";
import { PixiStage } from "./canvas/PixiStage";
import { CanvasToolbar } from "./ui/Toolbar";
import { CharacterSheet } from "./ui/CharacterSheet";
import { toast } from "./ui/Toast";
import type { MapDescriptor } from "./canvas/layers/MapLayer";
import type { TokenMoveDebugInfo, TokenRenderData } from "./canvas/layers/TokensLayer";
import {
  getActor,
  listActors,
  updateActor,
  type ActorDTO,
} from "./api/actors";
import type {
  ConnectedMessage,
  SceneDTO,
  SceneSnapshotMessage,
  TokenCreateAck,
  TokenCreateIn,
  TokenCreateOut,
  TokenDTO,
  TokenMoveAck,
  TokenMoveIn,
  TokenMoveOut,
  WsError,
} from "./types/ws";

type ServerRole = "MASTER" | "PLAYER" | null;

type WsStatus = "connected" | "disconnected" | "error";

type HttpStatus = "online" | "offline" | "error";

const layout = document.querySelector<HTMLElement>("#app-layout");
const panel = document.querySelector<HTMLElement>("#control-panel");
const panelToggle = document.querySelector<HTMLButtonElement>("#panel-toggle");
const httpStatusEl = document.querySelector<HTMLSpanElement>("#http-status");
const wsStatusEl = document.querySelector<HTMLSpanElement>("#ws-status");
const roleStatusEl = document.querySelector<HTMLSpanElement>("#role-status");
const roleBadgeEl = document.querySelector<HTMLSpanElement>("#role-badge");
const statusGridEl = document.querySelector<HTMLSpanElement>("#status-grid");
const statusZoomEl = document.querySelector<HTMLSpanElement>("#status-zoom");
const logContainer = document.querySelector<HTMLDivElement>("#event-log");
const pingButton = document.querySelector<HTMLButtonElement>("#ping-button");
const announceButton = document.querySelector<HTMLButtonElement>("#announce-button");
const loginForm = document.querySelector<HTMLFormElement>("#login-form");
const tokenForm = document.querySelector<HTMLFormElement>("#token-form");
const actorsRefreshButton = document.querySelector<HTMLButtonElement>("#actors-refresh");
const actorsStatusText = document.querySelector<HTMLParagraphElement>("#actors-status");
const actorsListEl = document.querySelector<HTMLUListElement>("#actors-list");
const tokenControls = document.querySelector<HTMLFieldSetElement>("#token-controls");
const canvas = document.querySelector<HTMLCanvasElement>("#scene");
const gridToggle = document.querySelector<HTMLInputElement>("#grid-toggle");
const highContrastToggle = document.querySelector<HTMLInputElement>("#grid-contrast-toggle");
const scaleStatus = document.querySelector<HTMLSpanElement>("#scale-status");
const toolbarContainer = document.querySelector<HTMLElement>("#canvas-toolbar");
const zoomOverlay = document.querySelector<HTMLElement>("#zoom-overlay");
const tokenNameInput = tokenForm?.querySelector<HTMLInputElement>("input[name=\"name\"]");
const tokenOwnerInput = tokenForm?.querySelector<HTMLInputElement>(
  "input[name=\"ownerUserId\"]"
);
const tokenSpriteInput = tokenForm?.querySelector<HTMLInputElement>("input[name=\"sprite\"]");
const tokenXInput = tokenForm?.querySelector<HTMLInputElement>("input[name=\"xCell\"]");
const tokenYInput = tokenForm?.querySelector<HTMLInputElement>("input[name=\"yCell\"]");
const tokenSceneInput = tokenForm?.querySelector<HTMLInputElement>("input[name=\"sceneId\"]");

let socket: Socket | null = null;
let authToken: string | null = window.sessionStorage.getItem("shrinevtt:token");
const storedRole = window.sessionStorage.getItem("shrinevtt:role");
let currentRole: ServerRole = storedRole === "MASTER" || storedRole === "PLAYER" ? storedRole : null;
let stage: PixiStage | null = null;
let toolbar: CanvasToolbar | null = null;
let characterSheet: CharacterSheet;
let actorsCache: ActorDTO[] = [];
let actorsLoading = false;
let highlightedActorId: string | null = null;
const storedUserId = window.sessionStorage.getItem("shrinevtt:userId");
let currentUserId: string | null = storedUserId && storedUserId.trim() ? storedUserId : null;
const tokens = new Map<string, TokenDTO>();
const localMoveVersions = new Map<string, number>();
let currentSceneId: string | null = null;
let pendingSnapshot: { scene: SceneDTO | null; tokens: TokenRenderData[] } | null = null;

const DEBUG_MOVES = (() => {
  if (typeof window === "undefined") {
    return false;
  }
  const globalFlag = (window as unknown as { DEBUG_MOVES?: unknown }).DEBUG_MOVES;
  if (typeof globalFlag === "boolean") {
    return globalFlag;
  }
  if (typeof globalFlag === "string") {
    return globalFlag.toLowerCase() === "true";
  }
  const envFlag = (import.meta.env?.VITE_DEBUG_MOVES as string | undefined) ?? undefined;
  if (typeof envFlag === "string") {
    return envFlag.toLowerCase() === "true";
  }
  return false;
})();

type PendingMoveRequest = {
  target: { xCell: number; yCell: number };
  revert: () => void;
  debug?: TokenMoveDebugInfo;
};

const pendingMoves = new Map<string, PendingMoveRequest>();
let moveDispatchTimer: number | null = null;
let lastMoveDispatch = 0;

const formatTime = () => new Date().toLocaleTimeString();

const appendLog = (message: string, payload?: unknown) => {
  if (!logContainer) {
    return;
  }

  const entry = document.createElement("div");
  const formatted = payload ? `${message}: ${JSON.stringify(payload)}` : message;
  entry.textContent = `[${formatTime()}] ${formatted}`;
  logContainer.prepend(entry);
};

const setActorsStatus = (message: string, tone: "default" | "error" = "default") => {
  if (!actorsStatusText) {
    return;
  }
  actorsStatusText.textContent = message;
  actorsStatusText.classList.toggle("is-error", tone === "error");
};

const updateActorsPanelState = () => {
  if (actorsRefreshButton) {
    actorsRefreshButton.disabled = !authToken || actorsLoading;
  }
};

const syncActorListHighlight = () => {
  if (!actorsListEl) {
    return;
  }
  const buttons = actorsListEl.querySelectorAll<HTMLButtonElement>(".actors-panel__actor");
  buttons.forEach((button) => {
    const id = button.dataset.actorId ?? "";
    button.classList.toggle("is-active", Boolean(highlightedActorId) && id === highlightedActorId);
  });
};

const highlightActor = (actorId: string | null) => {
  highlightedActorId = actorId;
  syncActorListHighlight();
};

const renderActorsList = () => {
  if (!actorsListEl) {
    return;
  }

  actorsListEl.replaceChildren();

  if (!authToken) {
    setActorsStatus("Войдите, чтобы увидеть связанных персонажей.");
    highlightActor(null);
    return;
  }

  if (actorsCache.length === 0) {
    setActorsStatus("Персонажи не найдены.");
    highlightActor(null);
    return;
  }

  setActorsStatus("");

  for (const actor of actorsCache) {
    const item = document.createElement("li");
    item.className = "actors-panel__item";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "actors-panel__actor";
    button.dataset.actorId = actor.id;

    const name = document.createElement("span");
    name.className = "actors-panel__name";
    name.textContent = actor.name;

    const meta = document.createElement("span");
    meta.className = "actors-panel__meta";
    meta.textContent = `AC ${actor.ac} • HP ${actor.maxHP} • PB +${actor.profBonus}`;

    button.append(name, meta);
    button.addEventListener("click", () => {
      highlightActor(actor.id);
      openActorSheet(actor.id);
    });

    item.append(button);
    actorsListEl.append(item);
  }

  syncActorListHighlight();
};

const upsertActorInCache = (actor: ActorDTO) => {
  const index = actorsCache.findIndex((item) => item.id === actor.id);
  if (index === -1) {
    actorsCache = [...actorsCache, actor];
  } else {
    actorsCache = actorsCache.map((item, idx) => (idx === index ? actor : item));
  }
  renderActorsList();
};

const ensureAuthToken = (): string => {
  if (!authToken) {
    throw new Error("Требуется авторизация");
  }
  return authToken;
};

const refreshActorsList = async (): Promise<void> => {
  if (!authToken) {
    actorsCache = [];
    highlightedActorId = null;
    renderActorsList();
    updateActorsPanelState();
    return;
  }

  actorsLoading = true;
  updateActorsPanelState();
  setActorsStatus("Загрузка…");

  try {
    const items = await listActors(ensureAuthToken());
    actorsCache = Array.isArray(items) ? items : [];
    renderActorsList();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось загрузить список персонажей";
    setActorsStatus(message, "error");
    toast.error(message);
  } finally {
    actorsLoading = false;
    updateActorsPanelState();
  }
};

function openActorSheet(actorId: string): void {
  if (!authToken) {
    toast.warn("Сначала войдите в систему");
    return;
  }

  characterSheet.open(actorId);
}

characterSheet = new CharacterSheet({
  loadActor: async (actorId) => getActor(actorId, ensureAuthToken()),
  updateActor: async (actorId, payload) => updateActor(actorId, payload, ensureAuthToken()),
  onActorUpdated: (actor) => {
    upsertActorInCache(actor);
    highlightActor(actor.id);
  },
});

renderActorsList();
updateActorsPanelState();

const panelSectionToggles = Array.from(
  document.querySelectorAll<HTMLButtonElement>(".panel-section__toggle")
);

for (const toggle of panelSectionToggles) {
  const section = toggle.closest(".panel-section");
  if (!section) {
    continue;
  }

  toggle.addEventListener("click", () => {
    section.classList.toggle("is-collapsed");
  });
}

actorsRefreshButton?.addEventListener("click", () => {
  void refreshActorsList();
});

if (panelToggle && layout) {
  panelToggle.addEventListener("click", () => {
    const collapsed = layout.classList.toggle("is-panel-collapsed");
    panelToggle.setAttribute("aria-expanded", (!collapsed).toString());
    panelToggle.textContent = collapsed ? "»«" : "«»";
  });
}

type ToolbarSnapshot = {
  zoomPercent: number;
  gridEnabled: boolean;
  snapEnabled: boolean;
};

const reflectToolbarState = (state: ToolbarSnapshot) => {
  if (scaleStatus) {
    scaleStatus.textContent = `${state.zoomPercent}%`;
  }
  if (statusZoomEl) {
    statusZoomEl.textContent = `${state.zoomPercent}%`;
  }
  if (statusGridEl) {
    statusGridEl.textContent = state.gridEnabled ? "on" : "off";
  }
  if (gridToggle) {
    gridToggle.checked = state.gridEnabled;
  }
};

const syncToolbarState = () => {
  if (!stage) {
    return;
  }

  const state: ToolbarSnapshot = {
    zoomPercent: Math.round(stage.getScale() * 100),
    gridEnabled: stage.isGridVisible(),
    snapEnabled: stage.isSnapEnabled(),
  };

  if (toolbar) {
    toolbar.updateState(state);
  } else {
    reflectToolbarState(state);
  }
};

const handleWsError = (error: WsError | undefined | null, scope: string) => {
  const fallbackMessage = `${scope}: неизвестная ошибка`;

  if (!error) {
    toast.error(fallbackMessage);
    appendLog(`${scope} error`, { message: "Unknown error" });
    return;
  }

  const message = error.message ?? fallbackMessage;
  const code = error.code ?? "unknown";
  const isWarning = code === "out_of_bounds" || code === "stale_update";

  if (code === "out_of_bounds") {
    toast.warn(message);
  } else if (isWarning) {
    toast.warn(message);
  } else {
    toast.error(message);
  }

  appendLog(`${scope} error`, {
    message,
    code,
    context: error.context ?? null,
  });
};

const shouldSkipHotkeys = (event: KeyboardEvent): boolean => {
  const target = event.target as HTMLElement | null;
  if (!target) {
    return false;
  }

  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }

  if (target.isContentEditable) {
    return true;
  }

  return event.metaKey || event.ctrlKey || event.altKey;
};

window.addEventListener("keydown", (event) => {
  if (!stage) {
    return;
  }

  if (shouldSkipHotkeys(event)) {
    return;
  }

  switch (event.key) {
    case "+":
    case "=":
      event.preventDefault();
      stage.zoomIn();
      return;
    case "-":
    case "_":
      event.preventDefault();
      stage.zoomOut();
      return;
    case "f":
    case "F":
      event.preventDefault();
      stage.fitToView();
      syncToolbarState();
      return;
    case "g":
    case "G":
      event.preventDefault();
      stage.toggleGrid();
      syncToolbarState();
      return;
    case "s":
    case "S":
      event.preventDefault();
      stage.toggleSnap();
      syncToolbarState();
      return;
    default:
      break;
  }
});

const dispatchMoveRequest = (tokenId: string, request: PendingMoveRequest) => {
  const token = tokens.get(tokenId);

  if (!socket || !token) {
    appendLog("TOKEN move denied", { message: "Нет соединения с сервером" });
    request.revert();
    if (token) {
      localMoveVersions.set(tokenId, token.version);
    } else {
      localMoveVersions.delete(tokenId);
    }
    return;
  }

  const confirmedVersion = localMoveVersions.get(tokenId) ?? token.version ?? 0;
  const nextVersion = confirmedVersion + 1;
  localMoveVersions.set(tokenId, nextVersion);

  const payload: TokenMoveIn = {
    tokenId,
    xCell: request.target.xCell,
    yCell: request.target.yCell,
    version: confirmedVersion,
    updatedAt: token.updatedAt,
  };

  if (DEBUG_MOVES && request.debug) {
    console.debug("TOKEN move debug", {
      tokenId,
      worldX: request.debug.worldX,
      worldY: request.debug.worldY,
      nx: request.debug.nx,
      ny: request.debug.ny,
      xCell: request.target.xCell,
      yCell: request.target.yCell,
      cols: request.debug.cols,
      rows: request.debug.rows,
    });
  }

  socket.emit("token.move:in", payload, (response: TokenMoveAck) => {
    if (!response?.ok) {
      const existing = tokens.get(tokenId);
      if (existing) {
        localMoveVersions.set(tokenId, existing.version);
      } else {
        localMoveVersions.delete(tokenId);
      }
      handleWsError(response?.error ?? null, "TOKEN move");
      request.revert();
      return;
    }

    if (response.token.sceneId === currentSceneId) {
      applyTokenUpdate(response.token);
    }
  });
};

const flushMoveQueue = () => {
  lastMoveDispatch = Date.now();
  const batch = Array.from(pendingMoves.entries());
  pendingMoves.clear();
  for (const [tokenId, request] of batch) {
    dispatchMoveRequest(tokenId, request);
  }
};

const scheduleMoveDispatch = () => {
  if (!pendingMoves.size) {
    return;
  }
  if (moveDispatchTimer !== null) {
    return;
  }

  const elapsed = Date.now() - lastMoveDispatch;
  const delay = Math.max(0, 50 - elapsed);

  moveDispatchTimer = window.setTimeout(() => {
    moveDispatchTimer = null;
    if (!pendingMoves.size) {
      return;
    }
    flushMoveQueue();
    if (pendingMoves.size) {
      scheduleMoveDispatch();
    }
  }, delay);
};

const enqueueMoveRequest = (tokenId: string, request: PendingMoveRequest) => {
  pendingMoves.set(tokenId, request);
  scheduleMoveDispatch();
};

const shouldApplyTokenUpdate = (token: TokenDTO): boolean => {
  const existing = tokens.get(token.id);
  if (!existing) {
    return true;
  }

  if (token.version > existing.version) {
    return true;
  }

  if (token.version < existing.version) {
    return false;
  }

  const incomingTime = new Date(token.updatedAt).getTime();
  const existingTime = new Date(existing.updatedAt).getTime();

  if (Number.isNaN(incomingTime) || Number.isNaN(existingTime)) {
    return true;
  }

  return incomingTime >= existingTime;
};

const applyTokenUpdate = (token: TokenDTO) => {
  if (!shouldApplyTokenUpdate(token)) {
    return;
  }

  tokens.set(token.id, token);
  localMoveVersions.set(token.id, token.version);
  stage?.upsertToken(toRenderToken(token));
};

const updateTokenControlsState = () => {
  if (tokenControls) {
    tokenControls.disabled = currentRole !== "MASTER" || !currentSceneId;
  }
};

const updateSceneInput = (sceneId: string | null) => {
  if (!tokenSceneInput) {
    return;
  }

  if (sceneId) {
    tokenSceneInput.value = sceneId;
    tokenSceneInput.placeholder = sceneId;
  } else {
    tokenSceneInput.value = "";
    tokenSceneInput.placeholder = "scene-id";
  }
};

const extractActorId = (token: TokenDTO): string | null => {
  const meta = token.meta;
  if (!meta || typeof meta !== "object") {
    return null;
  }

  const actorId = (meta as { actorId?: unknown }).actorId;
  if (typeof actorId === "string") {
    const trimmed = actorId.trim();
    return trimmed ? trimmed : null;
  }

  return null;
};

const toRenderToken = (token: TokenDTO): TokenRenderData => ({
  id: token.id,
  name: token.name,
  xCell: token.xCell,
  yCell: token.yCell,
  ownerUserId: token.ownerUserId,
  sprite: token.sprite,
  actorId: extractActorId(token),
});

const updateStageWithSnapshot = async (
  scene: SceneDTO | null,
  renderTokens: TokenRenderData[]
): Promise<void> => {
  if (!stage) {
    pendingSnapshot = { scene, tokens: renderTokens };
    return;
  }

  pendingSnapshot = null;

  if (scene) {
    await stage.applyScene({
      gridSize: scene.gridSize,
      widthPx: scene.widthPx,
      heightPx: scene.heightPx,
      mapImage: scene.mapImage,
    });
    stage.setTokens(renderTokens);
  } else {
    stage.setTokens([]);
  }
};

const applySceneSnapshot = async (
  scene: SceneDTO | null,
  sceneTokens: TokenDTO[]
): Promise<void> => {
  currentSceneId = scene?.id ?? null;
  updateSceneInput(currentSceneId);
  highlightActor(null);

  tokens.clear();
  localMoveVersions.clear();
  pendingMoves.clear();
  if (moveDispatchTimer !== null) {
    window.clearTimeout(moveDispatchTimer);
    moveDispatchTimer = null;
  }
  const renderTokens: TokenRenderData[] = [];

  for (const token of sceneTokens) {
    if (!scene || token.sceneId === scene.id) {
      tokens.set(token.id, token);
      localMoveVersions.set(token.id, token.version);
      renderTokens.push(toRenderToken(token));
    }
  }

  await updateStageWithSnapshot(scene, renderTokens);
  updateTokenControlsState();
  refreshTokenPermissions();
};

const refreshTokenPermissions = () => {
  if (!stage) {
    return;
  }

  stage.setTokenMovePermission((token) => {
    if (!token) {
      return false;
    }

    if (currentRole === "MASTER") {
      return true;
    }

    if (currentRole === "PLAYER") {
      return token.ownerUserId !== null && token.ownerUserId === currentUserId;
    }

    return false;
  });
};

const updateUserId = (userId: string | null) => {
  currentUserId = userId;

  if (userId) {
    window.sessionStorage.setItem("shrinevtt:userId", userId);
  } else {
    window.sessionStorage.removeItem("shrinevtt:userId");
  }

  refreshTokenPermissions();
};

const updateRole = (role: ServerRole) => {
  currentRole = role;
  if (roleStatusEl) {
    roleStatusEl.textContent = role ?? "—";
  }
  if (roleBadgeEl) {
    roleBadgeEl.textContent = role ?? "—";
  }
  if (role) {
    window.sessionStorage.setItem("shrinevtt:role", role);
  } else {
    window.sessionStorage.removeItem("shrinevtt:role");
  }
  if (announceButton) {
    announceButton.disabled = role !== "MASTER";
  }

  updateTokenControlsState();
  refreshTokenPermissions();
  updateActorsPanelState();
};

const updateHttpStatus = (status: HttpStatus) => {
  if (httpStatusEl) {
    httpStatusEl.textContent = status;
  }
};

const updateWsStatus = (status: WsStatus) => {
  if (wsStatusEl) {
    wsStatusEl.textContent = status;
  }
  if (pingButton) {
    pingButton.disabled = status !== "connected";
  }
};

const connectSocket = () => {
  if (!authToken) {
    return;
  }

  if (socket) {
    socket.disconnect();
  }

  socket = io("/game", {
    auth: {
      token: authToken,
      sessionId: "default",
    },
  });

  socket.on("connect", () => {
    updateWsStatus("connected");
    appendLog("WS connected", { id: socket?.id });
  });

  socket.on("disconnect", (reason) => {
    updateWsStatus("disconnected");
    appendLog("WS disconnected", { reason });
  });

  socket.on("connect_error", (err) => {
    updateWsStatus("error");
    appendLog("WS error", { message: err.message });
  });

  socket.on("connected", (payload: ConnectedMessage) => {
    updateUserId(payload.user?.id ?? currentUserId);
    updateRole(payload?.role ?? null);
    if (payload?.role) {
      toast.info(`Подключено как ${payload.role}`);
    } else {
      toast.info("Подключено");
    }
    appendLog("Handshake", payload);
  });

  socket.on("scene.snapshot", (payload: SceneSnapshotMessage) => {
    const sceneTokens = Array.isArray(payload.tokens) ? payload.tokens : [];
    appendLog("SCENE snapshot", {
      sceneId: payload.scene?.id ?? null,
      tokens: sceneTokens.length,
    });
    void applySceneSnapshot(payload.scene ?? null, sceneTokens);
  });

  socket.on("pong", (payload) => {
    appendLog("PONG", payload);
  });

  socket.on("announcement", (payload) => {
    appendLog("ANNOUNCEMENT", payload);
  });

  socket.on("token.create:out", (payload: TokenCreateOut) => {
    appendLog("TOKEN create", {
      id: payload.token.id,
      sceneId: payload.token.sceneId,
      name: payload.token.name,
      version: payload.token.version,
    });

    if (payload.token.sceneId !== currentSceneId) {
      return;
    }

    applyTokenUpdate(payload.token);
  });

  socket.on("token.move:out", (payload: TokenMoveOut) => {
    appendLog("TOKEN move", {
      id: payload.token.id,
      xCell: payload.token.xCell,
      yCell: payload.token.yCell,
      version: payload.token.version,
    });

    if (payload.token.sceneId !== currentSceneId) {
      return;
    }

    applyTokenUpdate(payload.token);
  });

  socket.on("error", (error: WsError) => {
    handleWsError(error, "WS");
  });
};

const authenticate = async (username: string, password: string) => {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error?.error ?? "Authentication failed");
    }

    const result = await response.json();
    authToken = result.token;
    updateUserId(result.user?.id ?? null);
    updateRole(result.user?.role ?? null);
    window.sessionStorage.setItem("shrinevtt:token", authToken);
    window.sessionStorage.setItem("shrinevtt:role", result.user?.role ?? "");
    appendLog("HTTP login", result.user);
    updateHttpStatus("online");
    toast.info("Авторизация успешна");
    void refreshActorsList();
    connectSocket();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    appendLog("Login error", { message });
    updateHttpStatus("error");
    toast.error(message);
  }
};

loginForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const username = formData.get("username");
  const password = formData.get("password");

  if (typeof username !== "string" || typeof password !== "string") {
    appendLog("Login error", { message: "Некорректные данные формы" });
    return;
  }

  void authenticate(username, password);
});

pingButton?.addEventListener("click", () => {
  if (!socket) {
    return;
  }

  socket.emit("ping", { at: new Date().toISOString() });
  appendLog("PING sent");
});

announceButton?.addEventListener("click", () => {
  if (!socket || currentRole !== "MASTER") {
    return;
  }

  const message = window.prompt(
    "Введите текст объявления",
    "Добро пожаловать в ShrineVTT!"
  );
  if (message) {
    socket.emit("gm:announcement", { message });
    appendLog("GM announcement", { message });
  }
});

tokenForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!socket || currentRole !== "MASTER") {
    appendLog("TOKEN create denied", { message: "Требуется роль MASTER" });
    return;
  }

  const formData = new FormData(tokenForm);
  const sceneIdRaw = formData.get("sceneId");
  const nameRaw = formData.get("name");
  const xCellRaw = formData.get("xCell");
  const yCellRaw = formData.get("yCell");

  if (typeof sceneIdRaw !== "string" || !sceneIdRaw.trim()) {
    appendLog("TOKEN create error", { message: "ID сцены обязателен" });
    return;
  }

  if (typeof nameRaw !== "string" || !nameRaw.trim()) {
    appendLog("TOKEN create error", { message: "Имя токена обязательно" });
    return;
  }

  const xCell = Number(xCellRaw);
  const yCell = Number(yCellRaw);

  if (!Number.isFinite(xCell) || !Number.isFinite(yCell)) {
    appendLog("TOKEN create error", { message: "Координаты должны быть числами" });
    return;
  }

  const ownerRaw = formData.get("ownerUserId");
  const spriteRaw = formData.get("sprite");

  const payload: TokenCreateIn = {
    sceneId: sceneIdRaw.trim(),
    name: nameRaw.trim(),
    xCell,
    yCell,
  };

  if (typeof ownerRaw === "string" && ownerRaw.trim()) {
    payload.ownerUserId = ownerRaw.trim();
  }

  if (typeof spriteRaw === "string" && spriteRaw.trim()) {
    payload.sprite = spriteRaw.trim();
  }

  socket.emit("token.create:in", payload, (response: TokenCreateAck) => {
    if (!response?.ok) {
      handleWsError(response?.error ?? null, "TOKEN create");
      return;
    }

    appendLog("TOKEN create requested", {
      id: response.token.id,
      name: response.token.name,
      sceneId: response.token.sceneId,
      version: response.token.version,
    });

    if (response.token.sceneId === currentSceneId) {
      applyTokenUpdate(response.token);
    }

    toast.info("Токен добавлен на сцену");

    if (tokenNameInput) {
      tokenNameInput.value = "";
    }
    if (tokenOwnerInput) {
      tokenOwnerInput.value = "";
    }
    if (tokenSpriteInput) {
      tokenSpriteInput.value = "";
    }
    if (tokenXInput) {
      tokenXInput.value = "";
    }
    if (tokenYInput) {
      tokenYInput.value = "";
    }

    tokenNameInput?.focus();
  });
});

const bootstrap = async () => {
  if (authToken) {
    try {
      const response = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        updateHttpStatus("online");
        updateUserId(data.user?.id ?? null);
        updateRole(data.user?.role ?? null);
        void refreshActorsList();
        connectSocket();
        return;
      }
      window.sessionStorage.removeItem("shrinevtt:token");
      window.sessionStorage.removeItem("shrinevtt:role");
      window.sessionStorage.removeItem("shrinevtt:userId");
      authToken = null;
      updateUserId(null);
      highlightActor(null);
      characterSheet.close();
      renderActorsList();
      updateActorsPanelState();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      appendLog("Session check failed", { message });
    }
  }

  updateHttpStatus("offline");
  updateWsStatus("disconnected");
  updateRole(null);
};

const setupStage = async () => {
  if (!canvas) {
    return;
  }

  const mapUrl = canvas.dataset.mapUrl;
  const mapDescriptor: MapDescriptor = mapUrl
    ? { url: mapUrl, fallbackColor: 0x1b1b1b }
    : { fallbackColor: 0x1b1b1b, fallbackSize: { width: 2048, height: 2048 } };

  const initialGrid = gridToggle?.checked ?? true;

  stage = await PixiStage.create({
    canvas,
    gridSize: 64,
    showGrid: initialGrid,
    map: mapDescriptor,
    onScaleChange: (value) => {
      const percent = Math.round(value * 100);
      const gridEnabled = stage?.isGridVisible() ?? initialGrid;
      const snapEnabled = stage?.isSnapEnabled() ?? true;
      if (toolbar) {
        toolbar.setZoom(percent);
        toolbar.showZoomOverlay(percent);
      }
      reflectToolbarState({ zoomPercent: percent, gridEnabled, snapEnabled });
    },
  });

  const initialState: ToolbarSnapshot = {
    zoomPercent: Math.round(stage.getScale() * 100),
    gridEnabled: stage.isGridVisible(),
    snapEnabled: stage.isSnapEnabled(),
  };

  if (toolbarContainer && zoomOverlay) {
    toolbar = new CanvasToolbar({
      stage,
      container: toolbarContainer,
      overlay: zoomOverlay,
      initialState,
      onStateChange: reflectToolbarState,
    });
  }

  reflectToolbarState(initialState);

  if (pendingSnapshot) {
    const snapshot = pendingSnapshot;
    pendingSnapshot = null;
    await updateStageWithSnapshot(snapshot.scene, snapshot.tokens);
  }

  if (gridToggle) {
    gridToggle.addEventListener("change", () => {
      if (!stage) {
        return;
      }
      stage.setGridVisible(gridToggle.checked);
      syncToolbarState();
    });
  }

  if (highContrastToggle) {
    highContrastToggle.addEventListener("change", () => {
      stage?.setHighContrastGrid(highContrastToggle.checked);
    });
  }

  stage.setTokenMoveHandler((tokenId, target, revert, debug) => {
    enqueueMoveRequest(tokenId, { target, revert, debug });
  });

  stage.setTokenSelectionHandler((token) => {
    const actorId = token?.actorId ?? null;
    highlightActor(actorId);
  });

  stage.setTokenActivateHandler((token) => {
    if (token.actorId) {
      highlightActor(token.actorId);
      openActorSheet(token.actorId);
    } else {
      toast.warn("У токена нет привязанного персонажа");
    }
  });

  refreshTokenPermissions();
};

void setupStage();
void bootstrap();
