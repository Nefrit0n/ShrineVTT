import { Server } from "socket.io";

import { getConfig } from "#config/index.js";
import { getSessionByToken } from "#auth/sessionService.js";
import { Roles } from "#auth/roles.js";

export const initSocketServer = (httpServer) => {
  const config = getConfig();

  const io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin === "*" ? true : config.corsOrigin,
      credentials: true,
    },
  });

  const gameNamespace = io.of("/game");

  gameNamespace.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const session = await getSessionByToken(token);

    if (!session) {
      return next(new Error("Invalid session token"));
    }

    socket.data.user = session.user;
    socket.data.session = session.session;

    return next();
  });

  gameNamespace.on("connection", (socket) => {
    const sessionId = socket.handshake.auth?.sessionId ?? "default";
    const roomId = `session:${sessionId}`;

    socket.join(roomId);

    socket.emit("connected", {
      message: "Connected to ShrineVTT",
      role: socket.data.user.role,
      sessionId,
    });

    socket.on("ping", (payload) => {
      socket.emit("pong", {
        received: payload ?? null,
        at: new Date().toISOString(),
      });
    });

    socket.on("gm:announcement", (payload) => {
      if (socket.data.user.role !== Roles.MASTER) {
        socket.emit("error", { message: "Forbidden", code: "forbidden" });
        return;
      }

      gameNamespace.to(roomId).emit("announcement", {
        from: socket.data.user.username,
        message: payload?.message ?? "",
        at: new Date().toISOString(),
      });
    });
  });

  return io;
};
