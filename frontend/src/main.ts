import { io, type Socket } from "socket.io-client";
import { PixiStage } from "./canvas/PixiStage";
import type { MapDescriptor } from "./canvas/MapLayer";

type ServerRole = "MASTER" | "PLAYER" | null;

type WsStatus = "connected" | "disconnected" | "error";

type HttpStatus = "online" | "offline" | "error";

type TokenDTO = {
  id: string;
  sceneId: string;
  ownerUserId: string | null;
  name: string;
  xCell: number;
  yCell: number;
  sprite: string | null;
  visibility: string;
  meta: Record<string, unknown>;
};

type TokenCreateAck =
  | { ok: true; token: TokenDTO }
  | { ok: false; error: string; code?: string; details?: unknown };

const httpStatusEl = document.querySelector<HTMLSpanElement>("#http-status");
const wsStatusEl = document.querySelector<HTMLSpanElement>("#ws-status");
const roleStatusEl = document.querySelector<HTMLSpanElement>("#role-status");
const logContainer = document.querySelector<HTMLDivElement>("#event-log");
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

let socket: Socket | null = null;
let authToken: string | null = window.sessionStorage.getItem("shrinevtt:token");
const storedRole = window.sessionStorage.getItem("shrinevtt:role");
let currentRole: ServerRole = storedRole === "MASTER" || storedRole === "PLAYER" ? storedRole : null;
let stage: PixiStage | null = null;

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

const updateRole = (role: ServerRole) => {
  currentRole = role;
  if (roleStatusEl) {
    roleStatusEl.textContent = role ?? "—";
  }
  if (announceButton) {
    announceButton.disabled = role !== "MASTER";
  }
  if (tokenControls) {
    tokenControls.disabled = role !== "MASTER";
  }
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

  socket.on("connected", (payload: { role?: ServerRole }) => {
    updateRole(payload?.role ?? null);
    appendLog("Handshake", payload);
  });

  socket.on("pong", (payload) => {
    appendLog("PONG", payload);
  });

  socket.on("announcement", (payload) => {
    appendLog("ANNOUNCEMENT", payload);
  });

  socket.on("token.create:out", (payload: { token: TokenDTO }) => {
    appendLog("TOKEN create", {
      id: payload.token.id,
      sceneId: payload.token.sceneId,
      name: payload.token.name,
    });
    stage?.upsertToken(payload.token);
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

  const payload: Record<string, unknown> = {
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
      appendLog("TOKEN create error", {
        message: response?.error ?? "Не удалось создать токен",
        code: response?.code,
        details: response?.details ?? undefined,
      });
      return;
    }

    appendLog("TOKEN create requested", {
      id: response.token.id,
      name: response.token.name,
      sceneId: response.token.sceneId,
    });

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
        updateRole(data.user?.role ?? null);
        connectSocket();
        return;
      }
      window.sessionStorage.removeItem("shrinevtt:token");
      window.sessionStorage.removeItem("shrinevtt:role");
      authToken = null;
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

  if (gridToggle) {
    gridToggle.addEventListener("change", () => {
      stage?.setGridVisible(gridToggle.checked);
    });
  }

  if (scaleIndicator) {
    scaleIndicator.textContent = `${Math.round(stage.getScale() * 100)}%`;
  }
};

void setupStage();
void bootstrap();
