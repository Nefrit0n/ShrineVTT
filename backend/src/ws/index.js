import { Server } from "socket.io";

import { getConfig } from "#config/index.js";
import { getSessionByToken } from "#auth/sessionService.js";
import { Roles } from "#auth/roles.js";
import { TokenService } from "#domain/services/TokenService.js";
import { DomainError } from "#domain/errors/DomainError.js";
import { sceneToPublicDTO } from "#domain/mappers/sceneMapper.js";
import { tokenToDTO } from "#domain/mappers/tokenMapper.js";
import { SceneRepository } from "#infra/repositories/SceneRepository.js";
import { TokenRepository } from "#infra/repositories/TokenRepository.js";
import { getDatabase } from "#storage/db.js";

const parseTokenCreatePayload = (payload = {}) => {
  const errors = {};
  const data = {};

  const sceneId =
    typeof payload.sceneId === "string" ? payload.sceneId.trim() : "";
  if (!sceneId) {
    errors.sceneId = "sceneId must be a non-empty string";
  } else {
    data.sceneId = sceneId;
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!name) {
    errors.name = "name must be a non-empty string";
  } else {
    data.name = name;
  }

  const xCell = Number(payload.xCell);
  if (!Number.isFinite(xCell)) {
    errors.xCell = "xCell must be a finite number";
  } else {
    data.xCell = xCell;
  }

  const yCell = Number(payload.yCell);
  if (!Number.isFinite(yCell)) {
    errors.yCell = "yCell must be a finite number";
  } else {
    data.yCell = yCell;
  }

  if (payload.ownerUserId !== undefined) {
    if (payload.ownerUserId === null) {
      data.ownerUserId = null;
    } else if (typeof payload.ownerUserId === "string") {
      const owner = payload.ownerUserId.trim();
      data.ownerUserId = owner || null;
    } else {
      errors.ownerUserId = "ownerUserId must be a string when provided";
    }
  }

  if (payload.sprite !== undefined) {
    if (payload.sprite === null) {
      data.sprite = null;
    } else if (typeof payload.sprite === "string") {
      const sprite = payload.sprite.trim();
      data.sprite = sprite || null;
    } else {
      errors.sprite = "sprite must be a string when provided";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data,
  };
};

const parseTokenMovePayload = (payload = {}) => {
  const errors = {};
  const data = {};

  const tokenId =
    typeof payload.tokenId === "string" ? payload.tokenId.trim() : "";
  if (!tokenId) {
    errors.tokenId = "tokenId must be a non-empty string";
  } else {
    data.tokenId = tokenId;
  }

  const xCell = Number(payload.xCell);
  if (!Number.isFinite(xCell)) {
    errors.xCell = "xCell must be a finite number";
  } else {
    data.xCell = xCell;
  }

  const yCell = Number(payload.yCell);
  if (!Number.isFinite(yCell)) {
    errors.yCell = "yCell must be a finite number";
  } else {
    data.yCell = yCell;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data,
  };
};

const mapDomainError = (error) => ({
  ok: false,
  error: error.message,
  code: error.code,
  details: error.details,
});

export const initSocketServer = (httpServer) => {
  const config = getConfig();

  const io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin === "*" ? true : config.corsOrigin,
      credentials: true,
    },
  });

  const gameNamespace = io.of("/game");

  const db = getDatabase();
  const sceneRepository = new SceneRepository(db);
  const tokenRepository = new TokenRepository(db);
  const tokenService = new TokenService({
    sceneRepository,
    tokenRepository,
  });

  const loadActiveSceneSnapshot = async (roomId) => {
    if (!roomId) {
      return null;
    }

    const scenes = await sceneRepository.listByRoom(roomId, { offset: 0, limit: 1 });
    if (!scenes.length) {
      return null;
    }

    const scene = scenes[0];
    const tokens = await tokenRepository.listByScene(scene.id, { offset: 0, limit: null });
    return { scene, tokens };
  };

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
    const logicalRoomId =
      socket.data.session?.roomId ?? socket.data.session?.id ?? sessionId;
    const roomChannel = `room:${logicalRoomId}`;

    socket.join(roomChannel);

    socket.emit("connected", {
      message: "Connected to ShrineVTT",
      role: socket.data.user.role,
      sessionId,
      roomId: logicalRoomId,
      user: {
        id: socket.data.user.id,
        username: socket.data.user.username,
      },
    });

    void (async () => {
      try {
        const snapshot = await loadActiveSceneSnapshot(logicalRoomId);
        socket.emit("scene.snapshot", {
          scene: snapshot ? sceneToPublicDTO(snapshot.scene) : null,
          tokens: snapshot ? snapshot.tokens.map((token) => tokenToDTO(token)) : [],
        });
      } catch (error) {
        console.error("Failed to send scene snapshot", error);
        socket.emit("scene.snapshot", { scene: null, tokens: [] });
      }
    })();

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

      gameNamespace.to(roomChannel).emit("announcement", {
        from: socket.data.user.username,
        message: payload?.message ?? "",
        at: new Date().toISOString(),
      });
    });

    socket.on("token.create:in", async (payload, callback) => {
      const reply = (response) => {
        if (typeof callback === "function") {
          callback(response);
        } else if (!response?.ok) {
          socket.emit("error", {
            message: response?.error ?? "Unknown error",
            code: response?.code ?? "error",
            details: response?.details,
          });
        }
      };

      if (socket.data.user.role !== Roles.MASTER) {
        reply({ ok: false, error: "Forbidden", code: "forbidden" });
        return;
      }

      const { valid, errors, data } = parseTokenCreatePayload(payload);

      if (!valid) {
        reply({
          ok: false,
          error: "Invalid payload",
          code: "invalid_payload",
          details: errors,
        });
        return;
      }

      try {
        const token = await tokenService.createToken({
          sceneId: data.sceneId,
          ownerUserId:
            data.ownerUserId === undefined || data.ownerUserId === null
              ? socket.data.user.id
              : data.ownerUserId,
          name: data.name,
          xCell: data.xCell,
          yCell: data.yCell,
          sprite: data.sprite ?? null,
        });

        const dto = tokenToDTO(token);
        gameNamespace.to(roomChannel).emit("token.create:out", { token: dto });
        reply({ ok: true, token: dto });
      } catch (error) {
        if (error instanceof DomainError) {
          reply(mapDomainError(error));
          return;
        }

        console.error("Failed to create token", error);
        reply({ ok: false, error: "Internal server error", code: "internal" });
      }
    });

    socket.on("token.move:in", async (payload, callback) => {
      const reply = (response) => {
        if (typeof callback === "function") {
          callback(response);
        } else if (!response?.ok) {
          socket.emit("error", {
            message: response?.error ?? "Unknown error",
            code: response?.code ?? "error",
            details: response?.details,
          });
        }
      };

      const { valid, errors, data } = parseTokenMovePayload(payload);

      if (!valid) {
        reply({
          ok: false,
          error: "Invalid payload",
          code: "invalid_payload",
          details: errors,
        });
        return;
      }

      const requesterId =
        socket.data.user.role === Roles.MASTER ? null : socket.data.user.id;

      try {
        const token = await tokenService.moveToken(
          data.tokenId,
          { xCell: data.xCell, yCell: data.yCell },
          requesterId
        );

        const dto = tokenToDTO(token);
        gameNamespace.to(roomChannel).emit("token.move:out", { token: dto });
        reply({ ok: true, token: dto });
      } catch (error) {
        if (error instanceof DomainError) {
          reply(mapDomainError(error));
          return;
        }

        console.error("Failed to move token", error);
        reply({ ok: false, error: "Internal server error", code: "internal" });
      }
    });
  });

  return io;
};
