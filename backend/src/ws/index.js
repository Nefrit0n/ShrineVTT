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

const TOKEN_MOVE_RATE_LIMIT_WINDOW_MS = 1000;
const TOKEN_MOVE_RATE_LIMIT_MAX = 20;

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

  if (payload.version !== undefined) {
    const version = Number(payload.version);
    if (!Number.isFinite(version) || !Number.isInteger(version)) {
      errors.version = "version must be an integer when provided";
    } else {
      data.expectedVersion = version;
    }
  }

  if (payload.updatedAt !== undefined) {
    if (typeof payload.updatedAt !== "string") {
      errors.updatedAt = "updatedAt must be an ISO timestamp string when provided";
    } else {
      const timestamp = payload.updatedAt.trim();
      const parsed = new Date(timestamp);
      if (!timestamp) {
        errors.updatedAt = "updatedAt must be a non-empty ISO timestamp string";
      } else if (Number.isNaN(parsed.getTime())) {
        errors.updatedAt = "updatedAt must be a valid ISO timestamp";
      } else {
        data.expectedUpdatedAt = parsed.toISOString();
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data,
  };
};

const mapDomainError = (error) => {
  const codeMap = {
    [DomainError.codes.OUT_OF_BOUNDS]: "token.out_of_bounds",
    [DomainError.codes.INVALID_GRID]: "scene.invalid_grid",
    [DomainError.codes.NOT_OWNER]: "token.not_owner",
    [DomainError.codes.NOT_FOUND]: "token.not_found",
    [DomainError.codes.STALE_UPDATE]: "token.stale_update",
    [DomainError.codes.INVALID_UPDATE]: "token.invalid_update",
  };

  const code = codeMap[error.code] ?? "domain.error";
  return {
    ok: false,
    error: {
      code,
      message: error.message,
      context: error.details ?? null,
    },
  };
};

const createWsError = (code, message, context = null) => ({
  ok: false,
  error: {
    code,
    message,
    context,
  },
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

  const moveRateBuckets = new Map();

  gameNamespace.on("connection", (socket) => {
    const sessionId = socket.handshake.auth?.sessionId ?? "default";
    const logicalRoomId =
      socket.data.session?.roomId ?? socket.data.session?.id ?? sessionId;
    const roomChannel = `room:${logicalRoomId}`;

    socket.join(roomChannel);

    const socketId = socket.id;
    moveRateBuckets.set(socketId, []);

    socket.on("disconnect", () => {
      moveRateBuckets.delete(socketId);
    });

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
        socket.emit(
          "error",
          {
            code: "forbidden",
            message: "Forbidden",
            context: null,
          }
        );
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
          socket.emit("error", response.error);
        }
      };

      if (socket.data.user.role !== Roles.MASTER) {
        reply(createWsError("forbidden", "Forbidden"));
        return;
      }

      const { valid, errors, data } = parseTokenCreatePayload(payload);

      if (!valid) {
        reply(createWsError("invalid_payload", "Invalid payload", errors));
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
        reply(createWsError("internal_error", "Internal server error"));
      }
    });

    socket.on("token.move:in", async (payload, callback) => {
      const reply = (response) => {
        if (typeof callback === "function") {
          callback(response);
        } else if (!response?.ok) {
          socket.emit("error", response.error);
        }
      };

      if (![Roles.MASTER, Roles.PLAYER].includes(socket.data.user.role)) {
        reply(createWsError("forbidden", "Forbidden"));
        return;
      }

      const now = Date.now();
      const bucket = moveRateBuckets.get(socketId);
      if (bucket) {
        const threshold = now - TOKEN_MOVE_RATE_LIMIT_WINDOW_MS;
        while (bucket.length && bucket[0] <= threshold) {
          bucket.shift();
        }
        if (bucket.length >= TOKEN_MOVE_RATE_LIMIT_MAX) {
          reply(
            createWsError("rate_limited", "Too many token.move requests", {
              windowMs: TOKEN_MOVE_RATE_LIMIT_WINDOW_MS,
              max: TOKEN_MOVE_RATE_LIMIT_MAX,
            })
          );
          return;
        }
        bucket.push(now);
      }

      const { valid, errors, data } = parseTokenMovePayload(payload);

      if (!valid) {
        reply(createWsError("invalid_payload", "Invalid payload", errors));
        return;
      }

      const requesterId =
        socket.data.user.role === Roles.MASTER ? null : socket.data.user.id;

      try {
        const token = await tokenService.moveToken(
          data.tokenId,
          { xCell: data.xCell, yCell: data.yCell },
          requesterId,
          {
            expectedVersion: data.expectedVersion,
            expectedUpdatedAt: data.expectedUpdatedAt,
          }
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
        reply(createWsError("internal_error", "Internal server error"));
      }
    });
  });

  return io;
};
