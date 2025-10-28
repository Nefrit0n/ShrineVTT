import { DomainError } from '../errors.js';

export const DOMAIN_ERROR_CODES = Object.freeze({
  INVALID_GRID: 'INVALID_GRID',
  OUT_OF_BOUNDS: 'OUT_OF_BOUNDS',
});

export function invalidGrid(message) {
  return new DomainError(message, { code: DOMAIN_ERROR_CODES.INVALID_GRID });
}

export function outOfBounds(message) {
  return new DomainError(message, { code: DOMAIN_ERROR_CODES.OUT_OF_BOUNDS });
}
