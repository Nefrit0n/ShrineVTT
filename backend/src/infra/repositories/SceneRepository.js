import { sceneFromRecord, sceneToRecord } from "../../domain/mappers/sceneMapper.js";

export class SceneRepository {
  constructor(db) {
    this.db = db;
  }

  async #ensureData() {
    await this.db.read();
    if (!this.db.data.scenes) {
      this.db.data.scenes = [];
    }
  }

  async create(scene) {
    await this.#ensureData();
    this.db.data.scenes.push(sceneToRecord(scene));
    await this.db.write();
    return scene;
  }

  async update(scene) {
    await this.#ensureData();
    const index = this.db.data.scenes.findIndex(({ id }) => id === scene.id);
    if (index === -1) {
      return null;
    }

    this.db.data.scenes[index] = sceneToRecord(scene);
    await this.db.write();
    return scene;
  }

  async delete(sceneId) {
    await this.#ensureData();
    const initialLength = this.db.data.scenes.length;
    this.db.data.scenes = this.db.data.scenes.filter(({ id }) => id !== sceneId);
    if (this.db.data.scenes.length !== initialLength) {
      await this.db.write();
      return true;
    }
    return false;
  }

  async findById(sceneId) {
    await this.#ensureData();
    const record = this.db.data.scenes.find(({ id }) => id === sceneId);
    return sceneFromRecord(record);
  }

  async listByRoom(roomId, { offset = 0, limit = 20 } = {}) {
    await this.#ensureData();
    const filtered = this.db.data.scenes.filter((scene) => scene.roomId === roomId);
    const start = Math.max(0, offset);
    const end = limit ? start + Math.max(0, limit) : undefined;
    return filtered.slice(start, end).map((record) => sceneFromRecord(record));
  }
}
