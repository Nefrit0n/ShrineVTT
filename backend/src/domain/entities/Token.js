import crypto from 'node:crypto';
import { DomainError } from '../errors.js';

function ensureInteger(value, field) {
  if (!Number.isInteger(value)) {
    throw new DomainError(`${field} must be an integer`);
  }
}

function normalizeRequiredString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new DomainError(`${field} must be a non-empty string`);
  }

  return value.trim();
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value);
  return normalized.length ? normalized : null;
}

export default class Token {
  constructor({
    id = crypto.randomUUID(),
    sceneId,
    ownerUserId = null,
    name,
    xCell,
    yCell,
    sprite = null,
    version = 0,
    updatedAt = new Date().toISOString(),
  }) {
    if (!sceneId) {
      throw new DomainError('Token.sceneId is required');
    }

    this.id = id;
    this.sceneId = sceneId;
    this.ownerUserId = ownerUserId ?? null;
    this.name = normalizeRequiredString(name, 'Token.name');

    ensureInteger(xCell, 'Token.xCell');
    ensureInteger(yCell, 'Token.yCell');
    ensureInteger(version, 'Token.version');

    if (version < 0) {
      throw new DomainError('Token.version cannot be negative');
    }

    this.xCell = xCell;
    this.yCell = yCell;
    this.sprite = normalizeOptionalString(sprite);
    this.version = version;
    this.updatedAt = updatedAt;
  }

  ensureWithinScene(scene) {
    if (!scene || typeof scene.ensureWithinBounds !== 'function') {
      throw new DomainError('A valid Scene instance is required to validate token bounds');
    }

    scene.ensureWithinBounds(this.xCell, this.yCell);
  }

  toObject() {
    return {
      id: this.id,
      sceneId: this.sceneId,
      ownerUserId: this.ownerUserId,
      name: this.name,
      xCell: this.xCell,
      yCell: this.yCell,
      sprite: this.sprite,
      version: this.version,
      updatedAt: this.updatedAt,
    };
  }
}
