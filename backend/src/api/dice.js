import { Router } from "express";

import { requireAuth } from "#auth/middleware.js";
import { DomainError } from "#domain/errors/DomainError.js";

const domainErrorToHttp = (error) => {
  if (!(error instanceof DomainError)) {
    return null;
  }

  switch (error.code) {
    case DomainError.codes.NOT_FOUND:
      return { status: 404, body: { error: error.message, code: error.code } };
    case DomainError.codes.INVALID_ROLL:
      return {
        status: 400,
        body: { error: error.message, code: error.code, details: error.details ?? undefined },
      };
    default:
      return { status: 400, body: { error: error.message, code: error.code } };
  }
};

export const createDiceRouter = ({ diceService } = {}) => {
  if (!diceService) {
    throw new Error("diceService dependency is required");
  }

  const router = Router();

  router.post("/roll", requireAuth, async (req, res) => {
    const payload = req.body ?? {};

    try {
      const result = await diceService.roll({
        expr: payload.expr,
        seed: payload.seed,
        actorId: payload.actorId,
        actor: payload.actor,
      });

      return res.status(200).json(result);
    } catch (error) {
      const mapped = domainErrorToHttp(error);
      if (mapped) {
        return res.status(mapped.status).json(mapped.body);
      }

      console.error("Failed to execute dice roll", error);
      return res.status(500).json({ error: "Failed to execute dice roll" });
    }
  });

  return router;
};

export default createDiceRouter;
