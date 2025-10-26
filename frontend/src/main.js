import { io } from "socket.io-client";

const httpStatusEl = document.querySelector("#http-status");
const wsStatusEl = document.querySelector("#ws-status");
const roleStatusEl = document.querySelector("#role-status");
const logContainer = document.querySelector("#event-log");
const pingButton = document.querySelector("#ping-button");
const announceButton = document.querySelector("#announce-button");
const loginForm = document.querySelector("#login-form");

let socket;
let authToken = window.sessionStorage.getItem("shrinevtt:token");
let currentRole = window.sessionStorage.getItem("shrinevtt:role");

const appendLog = (message, payload) => {
  const entry = document.createElement("div");
  const formatted = payload
    ? `${message}: ${JSON.stringify(payload)}`
    : message;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${formatted}`;
  logContainer?.prepend(entry);
};

const updateRole = (role) => {
  currentRole = role;
  roleStatusEl.textContent = role ?? "—";
  const isMaster = role === "MASTER";
  announceButton.disabled = !isMaster;
};

const updateHttpStatus = (status) => {
  httpStatusEl.textContent = status;
};

const updateWsStatus = (status) => {
  wsStatusEl.textContent = status;
  const isConnected = status === "connected";
  pingButton.disabled = !isConnected;
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
    appendLog("WS connected", { id: socket.id });
  });

  socket.on("disconnect", (reason) => {
    updateWsStatus("disconnected");
    appendLog("WS disconnected", { reason });
  });

  socket.on("connect_error", (err) => {
    updateWsStatus("error");
    appendLog("WS error", { message: err.message });
  });

  socket.on("connected", (payload) => {
    updateRole(payload?.role ?? null);
    appendLog("Handshake", payload);
  });

  socket.on("pong", (payload) => {
    appendLog("PONG", payload);
  });

  socket.on("announcement", (payload) => {
    appendLog("ANNOUNCEMENT", payload);
  });
};

const authenticate = async (username, password) => {
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
    appendLog("Login error", { message: error.message });
    updateHttpStatus("error");
  }
};

loginForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const username = formData.get("username");
  const password = formData.get("password");

  authenticate(username, password);
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

  const message = prompt(
    "Введите текст объявления",
    "Добро пожаловать в ShrineVTT!"
  );
  if (message) {
    socket.emit("gm:announcement", { message });
    appendLog("GM announcement", { message });
  }
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
      appendLog("Session check failed", { message: error.message });
    }
  }

  updateHttpStatus("offline");
  updateWsStatus("disconnected");
  updateRole(null);
};

bootstrap();
