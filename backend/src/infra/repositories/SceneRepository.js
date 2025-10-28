import { randomUUID } from 'node:crypto';
import Scene from '../../domain/entities/Scene.js';

const SCENE_COLUMNS = `id, name, gridSize, widthPx, heightPx, mapImage, createdAt, updatedAt`;

function mapRowToScene(row) {
  return row ? new Scene(row) : null;
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

export default class SceneRepository {
  constructor(db) {
    this.db = db;
  }

  create({ id = randomUUID(), name, gridSize, widthPx, heightPx, mapImage = null }) {
    const timestamp = new Date().toISOString();
    const scene = new Scene({
      id,
      name,
      gridSize,
      widthPx,
      heightPx,
      mapImage,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const sql = `
      INSERT INTO scenes (id, name, gridSize, widthPx, heightPx, mapImage, createdAt, updatedAt)
      VALUES (@id, @name, @gridSize, @widthPx, @heightPx, @mapImage, @createdAt, @updatedAt)
    `;

    this.db.prepare(sql).run({
      id: scene.id,
      name: scene.name,
      gridSize: scene.gridSize,
      widthPx: scene.widthPx,
      heightPx: scene.heightPx,
      mapImage: scene.mapImage,
      createdAt: scene.createdAt,
      updatedAt: scene.updatedAt,
    });

    return scene;
  }

  findById(id) {
    const sql = `SELECT ${SCENE_COLUMNS} FROM scenes WHERE id = ?`;
    const row = this.db.prepare(sql).get(id);
    return mapRowToScene(row);
  }

  listAll() {
    const sql = `SELECT ${SCENE_COLUMNS} FROM scenes ORDER BY createdAt ASC`;
    const rows = this.db.prepare(sql).all();
    return rows.map(mapRowToScene);
  }

  update(id, patch) {
    const sqlSelect = `SELECT ${SCENE_COLUMNS} FROM scenes WHERE id = ?`;
    const row = this.db.prepare(sqlSelect).get(id);
    if (!row) {
      return null;
    }

    const timestamp = new Date().toISOString();
    const data = coalescePatch(row, patch);
    data.id = id;
    data.updatedAt = timestamp;
    data.createdAt = row.createdAt;

    const scene = new Scene(data);

    const sqlUpdate = `
      UPDATE scenes
      SET name = @name,
          gridSize = @gridSize,
          widthPx = @widthPx,
          heightPx = @heightPx,
          mapImage = @mapImage,
          updatedAt = @updatedAt
      WHERE id = @id
    `;

    this.db.prepare(sqlUpdate).run({
      id: scene.id,
      name: scene.name,
      gridSize: scene.gridSize,
      widthPx: scene.widthPx,
      heightPx: scene.heightPx,
      mapImage: scene.mapImage,
      updatedAt: scene.updatedAt,
    });

    return scene;
  }

  delete(id) {
    const sql = `DELETE FROM scenes WHERE id = ?`;
    const result = this.db.prepare(sql).run(id);
    return result.changes > 0;
  }
}
