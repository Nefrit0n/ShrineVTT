import { DomainError as BaseDomainError } from '../errors.js';

export const OUT_OF_BOUNDS = 'OUT_OF_BOUNDS';
export const INVALID_GRID = 'INVALID_GRID';
export const STALE_UPDATE = 'STALE_UPDATE';

export class OutOfBoundsError extends BaseDomainError {
  constructor(message = 'Value is outside of allowed bounds') {
    super(message, { code: OUT_OF_BOUNDS });
  }
}

export class InvalidGridError extends BaseDomainError {
  constructor(message = 'Scene grid configuration is invalid') {
    super(message, { code: INVALID_GRID });
  }
}

export class StaleUpdateError extends BaseDomainError {
  constructor(message = 'Resource has been modified since it was read') {
    super(message, { code: STALE_UPDATE });
  }
}

export { BaseDomainError as DomainError };
