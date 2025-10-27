import { Router } from "express";

import { requireAuth, requireRole, RolesEnum } from "#auth/middleware.js";
import { SceneService } from "#domain/services/SceneService.js";
import { DomainError } from "#domain/errors/DomainError.js";
import { sceneToPublicDTO } from "#domain/mappers/sceneMapper.js";
import { tokenToDTO } from "#domain/mappers/tokenMapper.js";
import { SceneRepository } from "#infra/repositories/SceneRepository.js";
import { TokenRepository } from "#infra/repositories/TokenRepository.js";
import { getDatabase } from "#storage/db.js";

const router = Router();

let sceneServiceInstance;
let tokenRepositoryInstance;

const getServices = () => {
  if (!sceneServiceInstance || !tokenRepositoryInstance) {
    const db = getDatabase();
    const sceneRepository = new SceneRepository(db);
    tokenRepositoryInstance = new TokenRepository(db);
    sceneServiceInstance = new SceneService({ sceneRepository });
  }

  return { sceneService: sceneServiceInstance, tokenRepository: tokenRepositoryInstance };
};

const getRoomIdFromRequest = (req) => req.session?.roomId ?? req.session?.id ?? null;

const toPositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toPositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const validateCreatePayload = (payload = {}) => {
  const errors = {};

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!name) {
    errors.name = "name must be a non-empty string";
  }

  const gridSize = toPositiveInteger(payload.gridSize);
  if (gridSize === null) {
    errors.gridSize = "gridSize must be a positive integer";
  }

  const widthPx = toPositiveNumber(payload.widthPx);
  if (widthPx === null) {
    errors.widthPx = "widthPx must be a positive number";
  }

  const heightPx = toPositiveNumber(payload.heightPx);
  if (heightPx === null) {
    errors.heightPx = "heightPx must be a positive number";
  }

  if (payload.mapImage !== undefined && payload.mapImage !== null) {
    if (typeof payload.mapImage !== "string" || !payload.mapImage.trim()) {
      errors.mapImage = "mapImage must be a non-empty string when provided";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: {
      name,
      gridSize,
      widthPx,
      heightPx,
      mapImage:
        payload.mapImage === undefined
          ? undefined
          : payload.mapImage === null
            ? null
            : payload.mapImage,
    },
  };
};

const validatePatchPayload = (payload = {}) => {
  const errors = {};
  const result = {};

  if (
    payload.gridSize === undefined &&
    payload.widthPx === undefined &&
    payload.heightPx === undefined &&
    payload.mapImage === undefined
  ) {
    errors.payload = "At least one supported field must be provided";
  }

  if (payload.gridSize !== undefined) {
    const gridSize = toPositiveInteger(payload.gridSize);
    if (gridSize === null) {
      errors.gridSize = "gridSize must be a positive integer";
    } else {
      result.gridSize = gridSize;
    }
  }

  if (payload.widthPx !== undefined) {
    const widthPx = toPositiveNumber(payload.widthPx);
    if (widthPx === null) {
      errors.widthPx = "widthPx must be a positive number";
    } else {
      result.widthPx = widthPx;
    }
  }

  if (payload.heightPx !== undefined) {
    const heightPx = toPositiveNumber(payload.heightPx);
    if (heightPx === null) {
      errors.heightPx = "heightPx must be a positive number";
    } else {
      result.heightPx = heightPx;
    }
  }

  if (payload.mapImage !== undefined) {
    if (payload.mapImage === null) {
      result.mapImage = null;
    } else if (typeof payload.mapImage !== "string" || !payload.mapImage.trim()) {
      errors.mapImage = "mapImage must be a non-empty string when provided";
    } else {
      result.mapImage = payload.mapImage;
    }
  }

  return { valid: Object.keys(errors).length === 0, errors, data: result };
};

const domainErrorToHttp = (error) => {
  if (!(error instanceof DomainError)) {
    return null;
  }

  switch (error.code) {
    case DomainError.codes.NOT_FOUND:
      return { status: 404, body: { error: error.message, code: error.code } };
    case DomainError.codes.INVALID_GRID:
    case DomainError.codes.OUT_OF_BOUNDS:
      return { status: 400, body: { error: error.message, code: error.code } };
    case DomainError.codes.NOT_OWNER:
      return { status: 403, body: { error: error.message, code: error.code } };
    default:
      return { status: 400, body: { error: error.message, code: error.code } };
  }
};

const parseTokenPagination = (query = {}) => {
  const result = {};

  if (query.tokenOffset !== undefined) {
    const parsed = Number.parseInt(query.tokenOffset, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      throw new Error("tokenOffset must be a non-negative integer");
    }
    result.offset = parsed;
  }

  if (query.tokenLimit !== undefined) {
    const parsed = Number.parseInt(query.tokenLimit, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      throw new Error("tokenLimit must be a non-negative integer");
    }
    result.limit = parsed;
  }

  return result;
};

router.post("/", requireAuth, requireRole(RolesEnum.MASTER), async (req, res) => {
  const { valid, errors, data } = validateCreatePayload(req.body ?? {});

  if (!valid) {
    return res.status(400).json({ error: "Invalid payload", details: errors });
  }

  const roomId = getRoomIdFromRequest(req);

  if (!roomId) {
    return res.status(400).json({ error: "Session is not associated with a room" });
  }

  try {
    const { sceneService } = getServices();
    const scene = await sceneService.createScene({
      roomId,
      name: data.name,
      gridSize: data.gridSize,
      mapImage: data.mapImage ?? null,
      widthPx: data.widthPx,
      heightPx: data.heightPx,
    });

    return res.status(201).json({ scene: sceneToPublicDTO(scene) });
  } catch (error) {
    const mapped = domainErrorToHttp(error);
    if (mapped) {
      return res.status(mapped.status).json(mapped.body);
    }

    console.error(error);
    return res.status(500).json({ error: "Failed to create scene" });
  }
});

router.get("/:sceneId", requireAuth, async (req, res) => {
  const roomId = getRoomIdFromRequest(req);

  if (!roomId) {
    return res.status(400).json({ error: "Session is not associated with a room" });
  }

  let pagination;
  try {
    pagination = parseTokenPagination(req.query ?? {});
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  try {
    const { sceneService, tokenRepository } = getServices();
    const scene = await sceneService.getScene(req.params.sceneId);

    if (scene.roomId !== roomId && req.user.role !== RolesEnum.MASTER) {
      return res.status(403).json({ error: "Access to this scene is forbidden" });
    }

    const tokens = await tokenRepository.listByScene(req.params.sceneId, pagination);

    return res.json({
      scene: sceneToPublicDTO(scene),
      tokens: tokens.map((token) => tokenToDTO(token)),
    });
  } catch (error) {
    const mapped = domainErrorToHttp(error);
    if (mapped) {
      return res.status(mapped.status).json(mapped.body);
    }

    console.error(error);
    return res.status(500).json({ error: "Failed to load scene" });
  }
});

router.patch(
  "/:sceneId",
  requireAuth,
  requireRole(RolesEnum.MASTER),
  async (req, res) => {
    const roomId = getRoomIdFromRequest(req);

    if (!roomId) {
      return res.status(400).json({ error: "Session is not associated with a room" });
    }

    const { valid, errors, data } = validatePatchPayload(req.body ?? {});

    if (!valid) {
      return res.status(400).json({ error: "Invalid payload", details: errors });
    }

    try {
      const { sceneService } = getServices();
      const existing = await sceneService.getScene(req.params.sceneId);

      if (existing.roomId !== roomId) {
        return res.status(403).json({ error: "Access to this scene is forbidden" });
      }

      let updated = existing;

      if (data.gridSize !== undefined) {
        updated = await sceneService.changeGridSize(existing.id, data.gridSize);
      }

      if (
        data.mapImage !== undefined ||
        data.widthPx !== undefined ||
        data.heightPx !== undefined
      ) {
        updated = await sceneService.setBackground(existing.id, {
          mapImage: data.mapImage,
          widthPx: data.widthPx,
          heightPx: data.heightPx,
        });
      }

      return res.json({ scene: sceneToPublicDTO(updated) });
    } catch (error) {
      const mapped = domainErrorToHttp(error);
      if (mapped) {
        return res.status(mapped.status).json(mapped.body);
      }

      console.error(error);
      return res.status(500).json({ error: "Failed to update scene" });
    }
  }
);

export default router;
