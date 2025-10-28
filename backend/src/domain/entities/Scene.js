import crypto from 'node:crypto';
import { DomainError, InvalidGridError, OutOfBoundsError } from '../errors.js';

function ensurePositiveInteger(value, field) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new InvalidGridError(`${field} must be a positive integer`);
  }
}

function normalizeOptionalString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value);
  return normalized.length ? normalized : null;
}

export default class Scene {
  constructor({
    id = crypto.randomUUID(),
    sessionId,
    name,
    gridSize,
    widthPx,
    heightPx,
    mapImage = null,
    createdAt = new Date().toISOString(),
  }) {
    if (!sessionId) {
      throw new DomainError('Scene.sessionId is required');
    }

    if (typeof name !== 'string' || !name.trim()) {
      throw new DomainError('Scene.name must be a non-empty string');
    }

    ensurePositiveInteger(gridSize, 'Scene.gridSize');
    ensurePositiveInteger(widthPx, 'Scene.widthPx');
    ensurePositiveInteger(heightPx, 'Scene.heightPx');

    if (widthPx % gridSize !== 0) {
      throw new InvalidGridError('Scene.widthPx must be divisible by Scene.gridSize');
    }

    if (heightPx % gridSize !== 0) {
      throw new InvalidGridError('Scene.heightPx must be divisible by Scene.gridSize');
    }

    this.id = id;
    this.sessionId = sessionId;
    this.name = name.trim();
    this.gridSize = gridSize;
    this.widthPx = widthPx;
    this.heightPx = heightPx;
    this.mapImage = normalizeOptionalString(mapImage);
    this.createdAt = createdAt;
  }

  get columns() {
    return this.widthPx / this.gridSize;
  }

  get rows() {
    return this.heightPx / this.gridSize;
  }

  ensureWithinBounds(xCell, yCell) {
    if (!Number.isInteger(xCell) || !Number.isInteger(yCell)) {
      throw new OutOfBoundsError('Token coordinates must be integers');
    }

    if (xCell < 0 || yCell < 0 || xCell >= this.columns || yCell >= this.rows) {
      throw new OutOfBoundsError('Token coordinates are outside of the scene bounds');
    }
  }

  toObject() {
    return {
      id: this.id,
      sessionId: this.sessionId,
      name: this.name,
      gridSize: this.gridSize,
      widthPx: this.widthPx,
      heightPx: this.heightPx,
      mapImage: this.mapImage,
      createdAt: this.createdAt,
    };
  }
}
