import {
  tokenFromRecord,
  tokenToRecord,
} from "../../domain/mappers/tokenMapper.js";

export class TokenRepository {
  constructor(db) {
    this.db = db;
  }

  async #ensureData() {
    await this.db.read();
    if (!this.db.data.tokens) {
      this.db.data.tokens = [];
    }
    if (!this.db.data.scenes) {
      this.db.data.scenes = [];
    }
  }

  async create(token) {
    await this.#ensureData();
    this.db.data.tokens.push(tokenToRecord(token));
    await this.db.write();
    return token;
  }

  async update(token) {
    await this.#ensureData();
    const index = this.db.data.tokens.findIndex(({ id }) => id === token.id);
    if (index === -1) {
      return null;
    }

    this.db.data.tokens[index] = tokenToRecord(token);
    await this.db.write();
    return token;
  }

  async delete(tokenId) {
    await this.#ensureData();
    const initialLength = this.db.data.tokens.length;
    this.db.data.tokens = this.db.data.tokens.filter(({ id }) => id !== tokenId);
    if (this.db.data.tokens.length !== initialLength) {
      await this.db.write();
      return true;
    }
    return false;
  }

  async findById(tokenId) {
    await this.#ensureData();
    const record = this.db.data.tokens.find(({ id }) => id === tokenId);
    return tokenFromRecord(record);
  }

  async listByScene(sceneId, { offset = 0, limit = null } = {}) {
    await this.#ensureData();
    const filtered = this.db.data.tokens.filter((token) => token.sceneId === sceneId);
    const start = Math.max(0, offset);
    const end = limit ? start + Math.max(0, limit) : undefined;
    return filtered.slice(start, end).map((record) => tokenFromRecord(record));
  }

  async listByRoom(roomId, { offset = 0, limit = null } = {}) {
    await this.#ensureData();
    const sceneById = new Map(
      this.db.data.scenes.map((scene) => [scene.id, scene.roomId])
    );

    const filtered = this.db.data.tokens.filter((token) => {
      const tokenRoomId = sceneById.get(token.sceneId);
      return tokenRoomId === roomId;
    });

    const start = Math.max(0, offset);
    const end = limit ? start + Math.max(0, limit) : undefined;
    return filtered.slice(start, end).map((record) => tokenFromRecord(record));
  }
}
