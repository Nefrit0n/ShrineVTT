import { nanoid } from "nanoid";

import { Item } from "#domain/entities/Item.js";
import { DomainError } from "#domain/errors/DomainError.js";

export class ItemService {
  constructor({ itemRepository } = {}) {
    if (!itemRepository) {
      throw new Error("itemRepository dependency is required");
    }

    this.itemRepository = itemRepository;
  }

  async createItem({ name, type, data }) {
    const item = new Item({ id: nanoid(), name, type, data });
    await this.itemRepository.create(item);
    return item;
  }

  async getItem(itemId) {
    const item = await this.itemRepository.findById(itemId);
    if (!item) {
      throw new DomainError(
        DomainError.codes.NOT_FOUND,
        `Item with id ${itemId} was not found`
      );
    }
    return item;
  }

  async updateItem(itemId, updates = {}) {
    const item = await this.getItem(itemId);
    const updated = item.withUpdates(updates);
    await this.itemRepository.update(updated);
    return updated;
  }

  async deleteItem(itemId) {
    const deleted = await this.itemRepository.delete(itemId);
    if (!deleted) {
      throw new DomainError(
        DomainError.codes.NOT_FOUND,
        `Item with id ${itemId} was not found`
      );
    }
    return true;
  }

  async listItems(pagination = {}) {
    return this.itemRepository.list(pagination);
  }
}
