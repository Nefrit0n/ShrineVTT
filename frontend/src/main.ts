import { io, type Socket } from "socket.io-client";
import { PixiStage } from "./canvas/PixiStage";
import type { MapDescriptor } from "./canvas/layers/MapLayer";
import type { TokenRenderData } from "./canvas/layers/TokensLayer";
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

const httpStatusEl = document.querySelector<HTMLSpanElement>("#http-status");
const wsStatusEl = document.querySelector<HTMLSpanElement>("#ws-status");
const roleStatusEl = document.querySelector<HTMLSpanElement>("#role-status");
const logContainer = document.querySelector<HTMLDivElement>("#event-log");
const notificationsContainer =
  document.querySelector<HTMLDivElement>("#notifications");
const pingButton = document.querySelector<HTMLButtonElement>("#ping-button");
const announceButton = document.querySelector<HTMLButtonElement>("#announce-button");
const loginForm = document.querySelector<HTMLFormElement>("#login-form");
const tokenForm = document.querySelector<HTMLFormElement>("#token-form");
const tokenControls = document.querySelector<HTMLFieldSetElement>("#token-controls");
const canvas = document.querySelector<HTMLCanvasElement>("#scene");
const gridToggle = document.querySelector<HTMLInputElement>("#grid-toggle");
const scaleIndicator = document.querySelector<HTMLSpanElement>("#scale-indicator");
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
const storedUserId = window.sessionStorage.getItem("shrinevtt:userId");
let currentUserId: string | null = storedUserId && storedUserId.trim() ? storedUserId : null;
const tokens = new Map<string, TokenDTO>();
let currentSceneId: string | null = null;
let pendingSnapshot: { scene: SceneDTO | null; tokens: TokenRenderData[] } | null = null;

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

const pushNotification = (
  message: string,
  { type = "info", code }: { type?: "info" | "error"; code?: string } = {}
) => {
  if (!notificationsContainer) {
    return;
  }

  const item = document.createElement("div");
  item.classList.add("notification", `notification--${type}`);

  const text = document.createElement("span");
  text.textContent = message;
  item.append(text);

  if (code) {
    const codeBadge = document.createElement("span");
    codeBadge.classList.add("notification__code");
    codeBadge.textContent = code;
    item.append(codeBadge);
  }

  notificationsContainer.append(item);

  window.setTimeout(() => {
    item.classList.add("notification--hide");
    window.setTimeout(() => {
      item.remove();
    }, 300);
  }, 4000);
};

const handleWsError = (error: WsError | undefined | null, scope: string) => {
  if (!error) {
    const message = `${scope}: неизвестная ошибка`;
    pushNotification(message, { type: "error" });
    appendLog(`${scope} error`, { message: "Unknown error" });
    return;
  }

  pushNotification(error.message, { type: "error", code: error.code });
  appendLog(`${scope} error`, {
    message: error.message,
    code: error.code,
    context: error.context ?? null,
  });
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

const toRenderToken = (token: TokenDTO): TokenRenderData => ({
  id: token.id,
  name: token.name,
  xCell: token.xCell,
  yCell: token.yCell,
  ownerUserId: token.ownerUserId,
  sprite: token.sprite,
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

  tokens.clear();
  const renderTokens: TokenRenderData[] = [];

  for (const token of sceneTokens) {
    if (!scene || token.sceneId === scene.id) {
      tokens.set(token.id, token);
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
  if (announceButton) {
    announceButton.disabled = role !== "MASTER";
  }

  updateTokenControlsState();
  refreshTokenPermissions();
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
    connectSocket();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    appendLog("Login error", { message });
    updateHttpStatus("error");
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
        connectSocket();
        return;
      }
      window.sessionStorage.removeItem("shrinevtt:token");
      window.sessionStorage.removeItem("shrinevtt:role");
      window.sessionStorage.removeItem("shrinevtt:userId");
      authToken = null;
      updateUserId(null);
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

  stage = await PixiStage.create({
    canvas,
    gridSize: 64,
    showGrid: gridToggle?.checked ?? true,
    map: mapDescriptor,
    onScaleChange: (value) => {
      if (scaleIndicator) {
        scaleIndicator.textContent = `${Math.round(value * 100)}%`;
      }
    },
  });

  if (pendingSnapshot) {
    const snapshot = pendingSnapshot;
    pendingSnapshot = null;
    await updateStageWithSnapshot(snapshot.scene, snapshot.tokens);
  }

  if (gridToggle) {
    gridToggle.addEventListener("change", () => {
      stage?.setGridVisible(gridToggle.checked);
    });
  }

  stage.setTokenMoveHandler((tokenId, target, revert) => {
    const token = tokens.get(tokenId);
    if (!socket || !token) {
      appendLog("TOKEN move denied", { message: "Нет соединения с сервером" });
      revert();
      return;
    }

    const payload: TokenMoveIn = {
      tokenId,
      xCell: target.xCell,
      yCell: target.yCell,
      version: token.version,
      updatedAt: token.updatedAt,
    };

    socket.emit(
      "token.move:in",
      payload,
      (response: TokenMoveAck) => {
        if (!response?.ok) {
          handleWsError(response?.error ?? null, "TOKEN move");
          revert();
          return;
        }

        if (response.token.sceneId === currentSceneId) {
          applyTokenUpdate(response.token);
        }
      }
    );
  });

  refreshTokenPermissions();

  if (scaleIndicator) {
    scaleIndicator.textContent = `${Math.round(stage.getScale() * 100)}%`;
  }
};

void setupStage();
void bootstrap();
