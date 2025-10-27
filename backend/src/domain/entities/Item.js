import { DomainError } from "../errors/DomainError.js";
import { ABILITY_KEYS } from "./Actor.js";

export const ITEM_TYPES = ["weapon", "gear"];

const ensureNonEmptyString = (value, field) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new DomainError(
      DomainError.codes.INVALID_ITEM,
      `${field} must be a non-empty string`
    );
  }
  return value.trim();
};

const ensureWeaponData = (data = {}) => {
  if (data === null || typeof data !== "object") {
    throw new DomainError(
      DomainError.codes.INVALID_ITEM,
      "Weapon data must be an object"
    );
  }

  const damage = ensureNonEmptyString(data.damage, "data.damage");
  const ability = ensureNonEmptyString(data.ability, "data.ability").toUpperCase();

  if (!ABILITY_KEYS.includes(ability)) {
    throw new DomainError(
      DomainError.codes.INVALID_ITEM,
      `Weapon ability must be one of ${ABILITY_KEYS.join(", ")}`
    );
  }

  let finesse = undefined;
  if (data.finesse !== undefined) {
    if (typeof data.finesse !== "boolean") {
      throw new DomainError(
        DomainError.codes.INVALID_ITEM,
        "Weapon finesse must be a boolean when provided"
      );
    }
    finesse = data.finesse;
  }

  let critRange = undefined;
  if (data.critRange !== undefined) {
    const parsed = Number(data.critRange);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      throw new DomainError(
        DomainError.codes.INVALID_ITEM,
        "Weapon critRange must be an integer when provided"
      );
    }

    if (parsed < 2 || parsed > 20) {
      throw new DomainError(
        DomainError.codes.INVALID_ITEM,
        "Weapon critRange must be between 2 and 20"
      );
    }
    critRange = parsed;
  }

  return {
    damage,
    ability,
    ...(finesse !== undefined ? { finesse } : {}),
    ...(critRange !== undefined ? { critRange } : {}),
  };
};

const normalizeData = (type, data) => {
  if (type === "weapon") {
    return ensureWeaponData(data);
  }

  if (data === undefined) {
    return {};
  }

  if (data === null || typeof data !== "object") {
    throw new DomainError(
      DomainError.codes.INVALID_ITEM,
      "Item data must be an object when provided"
    );
  }

  return { ...data };
};

export class Item {
  constructor({ id, name, type, data }) {
    this.id = ensureNonEmptyString(id, "id");
    this.name = ensureNonEmptyString(name, "name");

    const normalizedType = ensureNonEmptyString(type, "type").toLowerCase();
    if (!ITEM_TYPES.includes(normalizedType)) {
      throw new DomainError(
        DomainError.codes.INVALID_ITEM,
        `type must be one of ${ITEM_TYPES.join(", ")}`
      );
    }
    this.type = normalizedType;

    this.data = normalizeData(this.type, data);
  }

  withUpdates({ name, type, data }) {
    const nextType =
      type !== undefined
        ? ensureNonEmptyString(type, "type").toLowerCase()
        : this.type;

    if (!ITEM_TYPES.includes(nextType)) {
      throw new DomainError(
        DomainError.codes.INVALID_ITEM,
        `type must be one of ${ITEM_TYPES.join(", ")}`
      );
    }

    const nextData = normalizeData(nextType, data !== undefined ? data : this.data);

    return new Item({
      id: this.id,
      name: name !== undefined ? ensureNonEmptyString(name, "name") : this.name,
      type: nextType,
      data: nextData,
    });
  }
}
