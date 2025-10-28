import { randomUUID } from 'node:crypto';
import { DomainError } from '../../errors.js';
import Scene from '../../domain/entities/Scene.js';
import Token from '../../domain/entities/Token.js';

const TOKEN_COLUMNS = `
  id, sceneId, ownerUserId, name, xCell, yCell, sprite, visibility, version, createdAt, updatedAt
`;
const SCENE_COLUMNS = `id, name, gridSize, widthPx, heightPx, mapImage, createdAt, updatedAt`;

function mapRowToToken(row) {
  return row ? new Token(row) : null;
}

function coalescePatch(base, patch) {
  const result = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

export default class TokenRepository {
  constructor(db) {
    this.db = db;
  }

  create({
    id = randomUUID(),
    sceneId,
    ownerUserId = null,
    name,
    xCell,
    yCell,
    sprite = null,
    visibility = 'public',
  }) {
    const scene = this.#getScene(sceneId);
    if (!scene) {
      throw new DomainError('Scene not found', { code: 'SCENE_NOT_FOUND' });
    }

    const timestamp = new Date().toISOString();
    const token = new Token(
      {
        id,
        sceneId: scene.id,
        ownerUserId,
        name,
        xCell,
        yCell,
        sprite,
        visibility,
        version: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      scene,
    );

    const sql = `
      INSERT INTO tokens (
        id, sceneId, ownerUserId, name, xCell, yCell, sprite, visibility, version, createdAt, updatedAt
      )
      VALUES (@id, @sceneId, @ownerUserId, @name, @xCell, @yCell, @sprite, @visibility, @version, @createdAt, @updatedAt)
    `;

    this.db.prepare(sql).run({
      id: token.id,
      sceneId: token.sceneId,
      ownerUserId: token.ownerUserId,
      name: token.name,
      xCell: token.xCell,
      yCell: token.yCell,
      sprite: token.sprite,
      visibility: token.visibility,
      version: token.version,
      createdAt: token.createdAt,
      updatedAt: token.updatedAt,
    });

    return token;
  }

  findById(id) {
    const sql = `SELECT ${TOKEN_COLUMNS} FROM tokens WHERE id = ?`;
    const row = this.db.prepare(sql).get(id);
    return mapRowToToken(row);
  }

  listByScene(sceneId) {
    const sql = `SELECT ${TOKEN_COLUMNS} FROM tokens WHERE sceneId = ? ORDER BY createdAt ASC`;
    const rows = this.db.prepare(sql).all(sceneId);
    return rows.map(mapRowToToken);
  }

  update(id, patch) {
    const sqlSelect = `SELECT ${TOKEN_COLUMNS} FROM tokens WHERE id = ?`;
    const row = this.db.prepare(sqlSelect).get(id);
    if (!row) {
      return null;
    }

    const sceneId = patch.sceneId ?? row.sceneId;
    const scene = this.#getScene(sceneId);
    if (!scene) {
      throw new DomainError('Scene not found', { code: 'SCENE_NOT_FOUND' });
    }

    const timestamp = new Date().toISOString();
    const data = coalescePatch(row, patch);
    data.sceneId = scene.id;
    data.updatedAt = timestamp;
    data.createdAt = row.createdAt;
    data.version = (row.version ?? 0) + 1;

    const token = new Token(data, scene);

    const sqlUpdate = `
      UPDATE tokens
      SET sceneId = @sceneId,
          ownerUserId = @ownerUserId,
          name = @name,
          xCell = @xCell,
          yCell = @yCell,
          sprite = @sprite,
          visibility = @visibility,
          version = @version,
          updatedAt = @updatedAt
      WHERE id = @id
    `;

    this.db.prepare(sqlUpdate).run({
      id: token.id,
      sceneId: token.sceneId,
      ownerUserId: token.ownerUserId,
      name: token.name,
      xCell: token.xCell,
      yCell: token.yCell,
      sprite: token.sprite,
      visibility: token.visibility,
      version: token.version,
      updatedAt: token.updatedAt,
    });

    return token;
  }

  delete(id) {
    const sql = `DELETE FROM tokens WHERE id = ?`;
    const result = this.db.prepare(sql).run(id);
    return result.changes > 0;
  }

  #getScene(id) {
    const sql = `SELECT ${SCENE_COLUMNS} FROM scenes WHERE id = ?`;
    const row = this.db.prepare(sql).get(id);
    return row ? new Scene(row) : null;
  }
}
