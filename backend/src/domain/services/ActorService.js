import { nanoid } from "nanoid";

import { Actor } from "#domain/entities/Actor.js";
import { DomainError } from "#domain/errors/DomainError.js";

export class ActorService {
  constructor({ actorRepository, itemRepository } = {}) {
    if (!actorRepository) {
      throw new Error("actorRepository dependency is required");
    }

    this.actorRepository = actorRepository;
    this.itemRepository = itemRepository ?? null;
  }

  async #ensureItemsExist(itemIds = []) {
    if (!this.itemRepository || !Array.isArray(itemIds) || itemIds.length === 0) {
      return;
    }

    const missing = [];
    for (const id of itemIds) {
      const item = await this.itemRepository.findById(id);
      if (!item) {
        missing.push(id);
      }
    }

    if (missing.length > 0) {
      throw new DomainError(
        DomainError.codes.INVALID_ACTOR,
        "Actor references unknown items",
        { missingItemIds: missing }
      );
    }
  }

  async createActor({ name, ownerUserId, abilities, profBonus, maxHP, ac, items }) {
    await this.#ensureItemsExist(items);

    const actor = new Actor({
      id: nanoid(),
      name,
      ownerUserId,
      abilities,
      profBonus,
      maxHP,
      ac,
      items,
    });

    await this.actorRepository.create(actor);
    return actor;
  }

  async getActor(actorId) {
    const actor = await this.actorRepository.findById(actorId);
    if (!actor) {
      throw new DomainError(
        DomainError.codes.NOT_FOUND,
        `Actor with id ${actorId} was not found`
      );
    }
    return actor;
  }

  async updateActor(actorId, updates = {}) {
    if (updates.items !== undefined) {
      await this.#ensureItemsExist(updates.items);
    }

    const actor = await this.getActor(actorId);
    const updated = actor.withUpdates(updates);
    await this.actorRepository.update(updated);
    return updated;
  }

  async deleteActor(actorId) {
    const deleted = await this.actorRepository.delete(actorId);
    if (!deleted) {
      throw new DomainError(
        DomainError.codes.NOT_FOUND,
        `Actor with id ${actorId} was not found`
      );
    }
    return true;
  }

  async listActors(pagination = {}) {
    return this.actorRepository.list(pagination);
  }

  async listActorsByOwner(ownerUserId, pagination = {}) {
    return this.actorRepository.listByOwner(ownerUserId, pagination);
  }
}
