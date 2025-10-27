import { actorFromRecord, actorToRecord } from "#domain/mappers/actorMapper.js";

export class ActorRepository {
  constructor(db) {
    this.db = db;
  }

  async #ensureData() {
    await this.db.read();
    if (!this.db.data.actors) {
      this.db.data.actors = [];
    }
  }

  async create(actor) {
    await this.#ensureData();
    this.db.data.actors.push(actorToRecord(actor));
    await this.db.write();
    return actor;
  }

  async update(actor) {
    await this.#ensureData();
    const index = this.db.data.actors.findIndex(({ id }) => id === actor.id);
    if (index === -1) {
      return null;
    }

    this.db.data.actors[index] = actorToRecord(actor);
    await this.db.write();
    return actor;
  }

  async delete(actorId) {
    await this.#ensureData();
    const initial = this.db.data.actors.length;
    this.db.data.actors = this.db.data.actors.filter(({ id }) => id !== actorId);
    if (this.db.data.actors.length !== initial) {
      await this.db.write();
      return true;
    }
    return false;
  }

  async findById(actorId) {
    await this.#ensureData();
    const record = this.db.data.actors.find(({ id }) => id === actorId);
    return actorFromRecord(record);
  }

  async list({ offset = 0, limit = 20 } = {}) {
    await this.#ensureData();
    const start = Math.max(0, offset);
    const end = limit ? start + Math.max(0, limit) : undefined;
    return this.db.data.actors
      .slice(start, end)
      .map((record) => actorFromRecord(record));
  }

  async listByOwner(ownerUserId, { offset = 0, limit = 20 } = {}) {
    await this.#ensureData();
    const filtered = this.db.data.actors.filter(
      (record) => record.ownerUserId === ownerUserId
    );
    const start = Math.max(0, offset);
    const end = limit ? start + Math.max(0, limit) : undefined;
    return filtered.slice(start, end).map((record) => actorFromRecord(record));
  }
}
