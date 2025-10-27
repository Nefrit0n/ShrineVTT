import { itemFromRecord, itemToRecord } from "#domain/mappers/itemMapper.js";

export class ItemRepository {
  constructor(db) {
    this.db = db;
  }

  async #ensureData() {
    await this.db.read();
    if (!this.db.data.items) {
      this.db.data.items = [];
    }
  }

  async create(item) {
    await this.#ensureData();
    this.db.data.items.push(itemToRecord(item));
    await this.db.write();
    return item;
  }

  async update(item) {
    await this.#ensureData();
    const index = this.db.data.items.findIndex(({ id }) => id === item.id);
    if (index === -1) {
      return null;
    }

    this.db.data.items[index] = itemToRecord(item);
    await this.db.write();
    return item;
  }

  async delete(itemId) {
    await this.#ensureData();
    const initial = this.db.data.items.length;
    this.db.data.items = this.db.data.items.filter(({ id }) => id !== itemId);
    if (this.db.data.items.length !== initial) {
      await this.db.write();
      return true;
    }
    return false;
  }

  async findById(itemId) {
    await this.#ensureData();
    const record = this.db.data.items.find(({ id }) => id === itemId);
    return itemFromRecord(record);
  }

  async list({ offset = 0, limit = 20 } = {}) {
    await this.#ensureData();
    const start = Math.max(0, offset);
    const end = limit ? start + Math.max(0, limit) : undefined;
    return this.db.data.items
      .slice(start, end)
      .map((record) => itemFromRecord(record));
  }
}
