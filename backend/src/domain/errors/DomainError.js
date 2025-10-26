export class DomainError extends Error {
  static codes = {
    OUT_OF_BOUNDS: "OUT_OF_BOUNDS",
    INVALID_GRID: "INVALID_GRID",
    NOT_OWNER: "NOT_OWNER",
    NOT_FOUND: "NOT_FOUND",
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
