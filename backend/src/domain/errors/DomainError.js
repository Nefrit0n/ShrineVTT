export class DomainError extends Error {
  static codes = {
    OUT_OF_BOUNDS: "OUT_OF_BOUNDS",
    INVALID_GRID: "INVALID_GRID",
    NOT_OWNER: "NOT_OWNER",
    NOT_FOUND: "NOT_FOUND",
    STALE_UPDATE: "STALE_UPDATE",
    INVALID_UPDATE: "INVALID_UPDATE",
    INVALID_ACTOR: "INVALID_ACTOR",
    INVALID_ITEM: "INVALID_ITEM",
    INVALID_ROLL: "INVALID_ROLL",
  };

  constructor(code, message, details = undefined) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}
