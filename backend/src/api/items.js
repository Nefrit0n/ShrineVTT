import { Router } from "express";

import { requireAuth, requireRole, RolesEnum } from "#auth/middleware.js";
import { DomainError } from "#domain/errors/DomainError.js";
import { itemToDTO } from "#domain/mappers/itemMapper.js";

const validateCreatePayload = (payload = {}) => {
  const errors = {};
  const result = {};

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!name) {
    errors.name = "name must be a non-empty string";
  } else {
    result.name = name;
  }

  const type = typeof payload.type === "string" ? payload.type.trim() : "";
  if (!type) {
    errors.type = "type must be a non-empty string";
  } else {
    result.type = type;
  }

  if (payload.data !== undefined) {
    result.data = payload.data;
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
    case DomainError.codes.INVALID_ITEM:
      return { status: 400, body: { error: error.message, code: error.code, details: error.details ?? undefined } };
    default:
      return { status: 400, body: { error: error.message, code: error.code } };
  }
};

export const createItemsRouter = ({ itemService } = {}) => {
  if (!itemService) {
    throw new Error("itemService dependency is required");
  }

  const router = Router();

  router.post("/", requireAuth, requireRole(RolesEnum.MASTER), async (req, res) => {
    const { valid, errors, data } = validateCreatePayload(req.body ?? {});

    if (!valid) {
      return res.status(400).json({ error: "Invalid payload", details: errors });
    }

    try {
      const item = await itemService.createItem(data);
      return res.status(201).json({ item: itemToDTO(item) });
    } catch (error) {
      const mapped = domainErrorToHttp(error);
      if (mapped) {
        return res.status(mapped.status).json(mapped.body);
      }

      console.error(error);
      return res.status(500).json({ error: "Failed to create item" });
    }
  });

  router.get("/:itemId", requireAuth, async (req, res) => {
    try {
      const item = await itemService.getItem(req.params.itemId);
      return res.json({ item: itemToDTO(item) });
    } catch (error) {
      const mapped = domainErrorToHttp(error);
      if (mapped) {
        return res.status(mapped.status).json(mapped.body);
      }

      console.error(error);
      return res.status(500).json({ error: "Failed to load item" });
    }
  });

  return router;
};

export default createItemsRouter;
