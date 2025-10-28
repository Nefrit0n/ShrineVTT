import crypto from 'node:crypto';
import Scene from '../../domain/entities/Scene.js';

function mapSceneRow(row) {
  if (!row) return null;
  return new Scene({
    id: row.id,
    sessionId: row.sessionId,
    name: row.name,
    gridSize: row.gridSize,
    widthPx: row.widthPx,
    heightPx: row.heightPx,
    mapImage: row.mapImage ?? null,
    createdAt: row.createdAt,
  });
}

function mergeSceneData(base, patch) {
  const merged = { ...base };
  for (const key of ['name', 'gridSize', 'widthPx', 'heightPx', 'mapImage']) {
    if (Object.prototype.hasOwnProperty.call(patch, key) && patch[key] !== undefined) {
      merged[key] = patch[key];
    }
  }
  return merged;
}

export default class SceneRepository {
  constructor(db) {
    if (!db) {
      throw new Error('db dependency is required');
    }

    this.db = db;

    this.insertSceneStmt = this.db.prepare(`
      INSERT INTO scenes (id, sessionId, name, gridSize, widthPx, heightPx, mapImage, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.findByIdStmt = this.db.prepare(`
      SELECT id, sessionId, name, gridSize, widthPx, heightPx, mapImage, createdAt
      FROM scenes
      WHERE id = ? AND sessionId = ?
    `);

    this.listBySessionStmt = this.db.prepare(`
      SELECT id, sessionId, name, gridSize, widthPx, heightPx, mapImage, createdAt
      FROM scenes
      WHERE sessionId = ?
      ORDER BY datetime(createdAt) DESC, id ASC
    `);

    this.updateSceneStmt = this.db.prepare(`
      UPDATE scenes
      SET name = ?, gridSize = ?, widthPx = ?, heightPx = ?, mapImage = ?
      WHERE id = ? AND sessionId = ?
    `);

    this.deleteSceneStmt = this.db.prepare(`
      DELETE FROM scenes
      WHERE id = ? AND sessionId = ?
    `);
  }

  create({ sessionId, name, gridSize, widthPx, heightPx, mapImage = null }) {
    const scene = new Scene({
      id: crypto.randomUUID(),
      sessionId,
      name,
      gridSize,
      widthPx,
      heightPx,
      mapImage,
      createdAt: new Date().toISOString(),
    });

    this.insertSceneStmt.run(
      scene.id,
      scene.sessionId,
      scene.name,
      scene.gridSize,
      scene.widthPx,
      scene.heightPx,
      scene.mapImage,
      scene.createdAt,
    );

    return scene;
  }

  findById({ sessionId, sceneId }) {
    if (!sessionId || !sceneId) return null;
    const row = this.findByIdStmt.get(sceneId, sessionId);
    return mapSceneRow(row);
  }

  listBySession(sessionId) {
    if (!sessionId) return [];
    return this.listBySessionStmt
      .all(sessionId)
      .map(mapSceneRow)
      .filter(Boolean);
  }

  update({ sessionId, sceneId, patch = {} }) {
    if (!sessionId || !sceneId) {
      throw new Error('sessionId and sceneId are required to update a scene');
    }

    const existing = this.findById({ sessionId, sceneId });
    if (!existing) return null;

    const merged = mergeSceneData(existing.toObject(), patch);
    const updatedScene = new Scene({ ...merged, id: sceneId, sessionId, createdAt: existing.createdAt });

    const info = this.updateSceneStmt.run(
      updatedScene.name,
      updatedScene.gridSize,
      updatedScene.widthPx,
      updatedScene.heightPx,
      updatedScene.mapImage,
      updatedScene.id,
      sessionId,
    );

    if (info.changes === 0) {
      return null;
    }

    return updatedScene;
  }

  delete({ sessionId, sceneId }) {
    if (!sessionId || !sceneId) return false;
    const info = this.deleteSceneStmt.run(sceneId, sessionId);
    return info.changes > 0;
  }
}
