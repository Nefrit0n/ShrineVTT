import { Router } from "express";

import { requireAuth, requireRole, RolesEnum } from "#auth/middleware.js";
import { DomainError } from "#domain/errors/DomainError.js";
import { ABILITY_KEYS } from "#domain/entities/Actor.js";
import { actorToDTO } from "#domain/mappers/actorMapper.js";

const parseAbilityScores = (abilities, { allowPartial = false } = {}) => {
  if (abilities === undefined) {
    return { ok: true, value: undefined };
  }

  if (abilities === null || typeof abilities !== "object") {
    return { ok: false, error: "abilities must be an object" };
  }

  const result = {};
  for (const [key, value] of Object.entries(abilities)) {
    if (!ABILITY_KEYS.includes(key)) {
      return { ok: false, error: `Unknown ability key: ${key}` };
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      return {
        ok: false,
        error: `Ability ${key} must be an integer between 1 and 30`,
      };
    }

    if (parsed < 1 || parsed > 30) {
      return {
        ok: false,
        error: `Ability ${key} must be an integer between 1 and 30`,
      };
    }

    result[key] = parsed;
  }

  if (!allowPartial) {
    for (const key of ABILITY_KEYS) {
      if (!(key in result)) {
        return { ok: false, error: `Ability ${key} is required` };
      }
    }
  }

  return { ok: true, value: result };
};

const parseIntegerInRange = (value, field, { min, max }) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return { ok: false, error: `${field} must be an integer between ${min} and ${max}` };
  }

  if (parsed < min || parsed > max) {
    return { ok: false, error: `${field} must be an integer between ${min} and ${max}` };
  }

  return { ok: true, value: parsed };
};

const parseNonNegativeInteger = (value, field) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    return { ok: false, error: `${field} must be a non-negative integer` };
  }

  return { ok: true, value: parsed };
};

const parseItems = (items) => {
  if (items === undefined) {
    return { ok: true, value: undefined };
  }

  if (!Array.isArray(items)) {
    return { ok: false, error: "items must be an array of strings" };
  }

  const parsed = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (typeof item !== "string" || !item.trim()) {
      return {
        ok: false,
        error: `items[${index}] must be a non-empty string`,
      };
    }
    parsed.push(item.trim());
  }

  return { ok: true, value: parsed };
};

const validateCreatePayload = (payload = {}) => {
  const errors = {};
  const data = {};

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!name) {
    errors.name = "name must be a non-empty string";
  } else {
    data.name = name;
  }

  const ownerUserId =
    typeof payload.ownerUserId === "string" ? payload.ownerUserId.trim() : "";
  if (!ownerUserId) {
    errors.ownerUserId = "ownerUserId must be a non-empty string";
  } else {
    data.ownerUserId = ownerUserId;
  }

  const abilitiesResult = parseAbilityScores(payload.abilities, {
    allowPartial: false,
  });
  if (!abilitiesResult.ok) {
    errors.abilities = abilitiesResult.error;
  } else {
    data.abilities = abilitiesResult.value;
  }

  const profBonusResult = parseIntegerInRange(payload.profBonus, "profBonus", {
    min: 0,
    max: 6,
  });
  if (!profBonusResult.ok) {
    errors.profBonus = profBonusResult.error;
  } else {
    data.profBonus = profBonusResult.value;
  }

  const maxHPResult = parseNonNegativeInteger(payload.maxHP, "maxHP");
  if (!maxHPResult.ok) {
    errors.maxHP = maxHPResult.error;
  } else {
    data.maxHP = maxHPResult.value;
  }

  const acResult = parseIntegerInRange(payload.ac, "ac", { min: 1, max: 30 });
  if (!acResult.ok) {
    errors.ac = acResult.error;
  } else {
    data.ac = acResult.value;
  }

  const itemsResult = parseItems(payload.items);
  if (!itemsResult.ok) {
    errors.items = itemsResult.error;
  } else if (itemsResult.value !== undefined) {
    data.items = itemsResult.value;
  }

  return { valid: Object.keys(errors).length === 0, errors, data };
};

const validatePatchPayload = (payload = {}) => {
  const errors = {};
  const data = {};

  if (payload.name !== undefined) {
    if (typeof payload.name !== "string" || !payload.name.trim()) {
      errors.name = "name must be a non-empty string";
    } else {
      data.name = payload.name.trim();
    }
  }

  if (payload.ownerUserId !== undefined) {
    if (typeof payload.ownerUserId !== "string" || !payload.ownerUserId.trim()) {
      errors.ownerUserId = "ownerUserId must be a non-empty string";
    } else {
      data.ownerUserId = payload.ownerUserId.trim();
    }
  }

  if (payload.abilities !== undefined) {
    const abilitiesResult = parseAbilityScores(payload.abilities, {
      allowPartial: true,
    });
    if (!abilitiesResult.ok) {
      errors.abilities = abilitiesResult.error;
    } else {
      data.abilities = abilitiesResult.value;
    }
  }

  if (payload.profBonus !== undefined) {
    const profBonusResult = parseIntegerInRange(payload.profBonus, "profBonus", {
      min: 0,
      max: 6,
    });
    if (!profBonusResult.ok) {
      errors.profBonus = profBonusResult.error;
    } else {
      data.profBonus = profBonusResult.value;
    }
  }

  if (payload.maxHP !== undefined) {
    const maxHPResult = parseNonNegativeInteger(payload.maxHP, "maxHP");
    if (!maxHPResult.ok) {
      errors.maxHP = maxHPResult.error;
    } else {
      data.maxHP = maxHPResult.value;
    }
  }

  if (payload.ac !== undefined) {
    const acResult = parseIntegerInRange(payload.ac, "ac", { min: 1, max: 30 });
    if (!acResult.ok) {
      errors.ac = acResult.error;
    } else {
      data.ac = acResult.value;
    }
  }

  if (payload.items !== undefined) {
    const itemsResult = parseItems(payload.items);
    if (!itemsResult.ok) {
      errors.items = itemsResult.error;
    } else {
      data.items = itemsResult.value;
    }
  }

  if (Object.keys(data).length === 0) {
    errors.payload = "At least one supported field must be provided";
  }

  return { valid: Object.keys(errors).length === 0, errors, data };
};

const domainErrorToHttp = (error) => {
  if (!(error instanceof DomainError)) {
    return null;
  }

  switch (error.code) {
    case DomainError.codes.NOT_FOUND:
      return { status: 404, body: { error: error.message, code: error.code } };
    case DomainError.codes.INVALID_ACTOR:
    case DomainError.codes.INVALID_ITEM:
      return {
        status: 400,
        body: { error: error.message, code: error.code, details: error.details ?? undefined },
      };
    case DomainError.codes.NOT_OWNER:
      return { status: 403, body: { error: error.message, code: error.code } };
    default:
      return { status: 400, body: { error: error.message, code: error.code } };
  }
};

export const createActorsRouter = ({ actorService } = {}) => {
  if (!actorService) {
    throw new Error("actorService dependency is required");
  }

  const router = Router();

  router.get("/", requireAuth, async (req, res) => {
    try {
      const actors =
        req.user.role === RolesEnum.MASTER
          ? await actorService.listActors()
          : await actorService.listActorsByOwner(req.user.id);

      return res.json({ actors: actors.map((actor) => actorToDTO(actor)) });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Failed to load actors" });
    }
  });

  router.post("/", requireAuth, requireRole(RolesEnum.MASTER), async (req, res) => {
    const { valid, errors, data } = validateCreatePayload(req.body ?? {});

    if (!valid) {
      return res.status(400).json({ error: "Invalid payload", details: errors });
    }

    try {
      const actor = await actorService.createActor(data);
      return res.status(201).json({ actor: actorToDTO(actor) });
    } catch (error) {
      const mapped = domainErrorToHttp(error);
      if (mapped) {
        return res.status(mapped.status).json(mapped.body);
      }

      console.error(error);
      return res.status(500).json({ error: "Failed to create actor" });
    }
  });

  router.get("/:actorId", requireAuth, async (req, res) => {
    try {
      const actor = await actorService.getActor(req.params.actorId);

      if (
        req.user.role !== RolesEnum.MASTER &&
        actor.ownerUserId !== req.user.id
      ) {
        return res.status(403).json({ error: "Access to this actor is forbidden" });
      }

      return res.json({ actor: actorToDTO(actor) });
    } catch (error) {
      const mapped = domainErrorToHttp(error);
      if (mapped) {
        return res.status(mapped.status).json(mapped.body);
      }

      console.error(error);
      return res.status(500).json({ error: "Failed to load actor" });
    }
  });

  router.patch("/:actorId", requireAuth, async (req, res) => {
    const { valid, errors, data } = validatePatchPayload(req.body ?? {});

    if (!valid) {
      return res.status(400).json({ error: "Invalid payload", details: errors });
    }

    try {
      const actor = await actorService.getActor(req.params.actorId);

      if (
        req.user.role !== RolesEnum.MASTER &&
        actor.ownerUserId !== req.user.id
      ) {
        return res.status(403).json({ error: "Access to this actor is forbidden" });
      }

      const updated = await actorService.updateActor(actor.id, data);
      return res.json({ actor: actorToDTO(updated) });
    } catch (error) {
      const mapped = domainErrorToHttp(error);
      if (mapped) {
        return res.status(mapped.status).json(mapped.body);
      }

      console.error(error);
      return res.status(500).json({ error: "Failed to update actor" });
    }
  });

  return router;
};

export default createActorsRouter;
