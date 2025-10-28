import crypto from 'node:crypto';
import Token from '../../domain/entities/Token.js';
import { StaleUpdateError } from '../../domain/errors.js';

function mapTokenRow(row) {
  if (!row) return null;
  return new Token({
    id: row.id,
    sceneId: row.sceneId,
    ownerUserId: row.ownerUserId ?? null,
    name: row.name,
    xCell: row.xCell,
    yCell: row.yCell,
    sprite: row.sprite ?? null,
    version: row.version,
    updatedAt: row.updatedAt,
  });
}

function mergeTokenData(base, patch) {
  const merged = { ...base };
  for (const key of ['name', 'xCell', 'yCell', 'sprite', 'ownerUserId']) {
    if (Object.prototype.hasOwnProperty.call(patch, key) && patch[key] !== undefined) {
      merged[key] = patch[key];
    }
  }
  return merged;
}

export default class TokenRepository {
  constructor(db) {
    if (!db) {
      throw new Error('db dependency is required');
    }

    this.db = db;

    this.insertTokenStmt = this.db.prepare(`
      INSERT INTO tokens (id, sceneId, ownerUserId, name, xCell, yCell, sprite, version, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.findByIdStmt = this.db.prepare(`
      SELECT t.id, t.sceneId, t.ownerUserId, t.name, t.xCell, t.yCell, t.sprite, t.version, t.updatedAt
      FROM tokens t
      INNER JOIN scenes s ON s.id = t.sceneId
      WHERE t.id = ? AND s.sessionId = ?
    `);

    this.listBySceneStmt = this.db.prepare(`
      SELECT t.id, t.sceneId, t.ownerUserId, t.name, t.xCell, t.yCell, t.sprite, t.version, t.updatedAt
      FROM tokens t
      INNER JOIN scenes s ON s.id = t.sceneId
      WHERE t.sceneId = ? AND s.sessionId = ?
      ORDER BY datetime(t.updatedAt) ASC, t.id ASC
    `);

    this.updateTokenStmt = this.db.prepare(`
      UPDATE tokens
      SET ownerUserId = ?, name = ?, xCell = ?, yCell = ?, sprite = ?, version = ?, updatedAt = ?
      WHERE id = ? AND sceneId = ? AND version = ?
    `);

    this.deleteTokenStmt = this.db.prepare(`
      DELETE FROM tokens
      WHERE id = ? AND sceneId = ?
    `);

    this.deleteBySceneStmt = this.db.prepare(`
      DELETE FROM tokens
      WHERE sceneId = ?
    `);
  }

  create({ scene, ownerUserId = null, name, xCell, yCell, sprite = null }) {
    if (!scene || typeof scene.ensureWithinBounds !== 'function') {
      throw new Error('scene is required to create a token');
    }

    scene.ensureWithinBounds(xCell, yCell);

    const token = new Token({
      id: crypto.randomUUID(),
      sceneId: scene.id,
      ownerUserId,
      name,
      xCell,
      yCell,
      sprite,
      version: 0,
      updatedAt: new Date().toISOString(),
    });

    this.insertTokenStmt.run(
      token.id,
      token.sceneId,
      token.ownerUserId,
      token.name,
      token.xCell,
      token.yCell,
      token.sprite,
      token.version,
      token.updatedAt,
    );

    return token;
  }

  findById({ sessionId, tokenId }) {
    if (!sessionId || !tokenId) return null;
    const row = this.findByIdStmt.get(tokenId, sessionId);
    return mapTokenRow(row);
  }

  listByScene({ sessionId, sceneId }) {
    if (!sessionId || !sceneId) return [];
    return this.listBySceneStmt
      .all(sceneId, sessionId)
      .map(mapTokenRow)
      .filter(Boolean);
  }

  update({ scene, tokenId, patch = {}, expectedVersion }) {
    if (!scene || typeof scene.ensureWithinBounds !== 'function') {
      throw new Error('scene is required to update a token');
    }

    if (!tokenId) {
      throw new Error('tokenId is required to update a token');
    }

    if (!Number.isInteger(expectedVersion)) {
      throw new Error('expectedVersion must be provided as an integer for token updates');
    }

    const existing = this.findById({ sessionId: scene.sessionId, tokenId });
    if (!existing || existing.sceneId !== scene.id) {
      return null;
    }

    if (existing.version !== expectedVersion) {
      throw new StaleUpdateError('Token has been modified since it was read');
    }

    const merged = mergeTokenData(existing.toObject(), patch);
    merged.id = existing.id;
    merged.sceneId = existing.sceneId;

    scene.ensureWithinBounds(merged.xCell, merged.yCell);

    const updatedAt = new Date().toISOString();
    const nextVersion = existing.version + 1;

    const updatedToken = new Token({
      ...merged,
      version: nextVersion,
      updatedAt,
    });

    const info = this.updateTokenStmt.run(
      updatedToken.ownerUserId,
      updatedToken.name,
      updatedToken.xCell,
      updatedToken.yCell,
      updatedToken.sprite,
      updatedToken.version,
      updatedToken.updatedAt,
      updatedToken.id,
      updatedToken.sceneId,
      existing.version,
    );

    if (info.changes === 0) {
      throw new StaleUpdateError('Token update failed due to version mismatch');
    }

    return updatedToken;
  }

  delete({ scene, tokenId }) {
    if (!scene || !tokenId) return false;
    const info = this.deleteTokenStmt.run(tokenId, scene.id);
    return info.changes > 0;
  }

  deleteByScene(sceneId) {
    if (!sceneId) return 0;
    const info = this.deleteBySceneStmt.run(sceneId);
    return info.changes;
  }
}
