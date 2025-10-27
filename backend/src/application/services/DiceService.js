import { DomainError } from "#domain/errors/DomainError.js";
import { DiceEngine } from "#modules/dice/DiceEngine.js";

export class DiceService {
  constructor({ diceEngine, actorService } = {}) {
    if (!diceEngine || !(diceEngine instanceof DiceEngine)) {
      throw new Error("diceEngine dependency is required");
    }

    this.diceEngine = diceEngine;
    this.actorService = actorService ?? null;
  }

  async roll({ expr, seed, actorId, actor } = {}) {
    if (typeof expr !== "string" || !expr.trim()) {
      throw new DomainError(
        DomainError.codes.INVALID_ROLL,
        "expr must be a non-empty string"
      );
    }

    let actorContext = actor ?? null;

    if (!actorContext && actorId) {
      if (!this.actorService) {
        throw new DomainError(
          DomainError.codes.INVALID_ROLL,
          "actorId was provided but actorService is not configured"
        );
      }

      actorContext = await this.actorService.getActor(actorId);
    }

    return this.diceEngine.roll(expr, { seed, actor: actorContext });
  }
}

export default DiceService;
