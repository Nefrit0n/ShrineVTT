import { DomainError } from "../errors/DomainError.js";

export const ABILITY_KEYS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

const normalizeAbilities = (abilities, base = undefined) => {
  if (abilities === undefined) {
    if (!base) {
      throw new DomainError(
        DomainError.codes.INVALID_ACTOR,
        "abilities must include all six ability scores"
      );
    }
    return normalizeAbilities(base);
  }

  if (abilities === null || typeof abilities !== "object") {
    throw new DomainError(
      DomainError.codes.INVALID_ACTOR,
      "abilities must be an object"
    );
  }

  const combined = base ? { ...base, ...abilities } : { ...abilities };

  const normalized = {};
  for (const key of ABILITY_KEYS) {
    const raw = combined[key];
    if (raw === undefined) {
      throw new DomainError(
        DomainError.codes.INVALID_ACTOR,
        `Ability score ${key} is required`
      );
    }

    const value = Number(raw);
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new DomainError(
        DomainError.codes.INVALID_ACTOR,
        `Ability score ${key} must be an integer`
      );
    }

    if (value < 1 || value > 30) {
      throw new DomainError(
        DomainError.codes.INVALID_ACTOR,
        `Ability score ${key} must be between 1 and 30`
      );
    }

    normalized[key] = value;
  }

  for (const key of Object.keys(combined)) {
    if (!ABILITY_KEYS.includes(key)) {
      throw new DomainError(
        DomainError.codes.INVALID_ACTOR,
        `Unknown ability score key: ${key}`
      );
    }
  }

  return normalized;
};

const ensureNonEmptyString = (value, field) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new DomainError(
      DomainError.codes.INVALID_ACTOR,
      `${field} must be a non-empty string`
    );
  }
  return value.trim();
};

const ensureIntegerInRange = (value, field, { min, max }) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new DomainError(
      DomainError.codes.INVALID_ACTOR,
      `${field} must be an integer`
    );
  }

  if (parsed < min || parsed > max) {
    throw new DomainError(
      DomainError.codes.INVALID_ACTOR,
      `${field} must be between ${min} and ${max}`
    );
  }

  return parsed;
};

const ensureNonNegativeInteger = (value, field) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    throw new DomainError(
      DomainError.codes.INVALID_ACTOR,
      `${field} must be a non-negative integer`
    );
  }
  return parsed;
};

const normalizeItems = (items) => {
  if (items === undefined) {
    return [];
  }

  if (!Array.isArray(items)) {
    throw new DomainError(
      DomainError.codes.INVALID_ACTOR,
      "items must be an array of strings"
    );
  }

  return items.map((item, index) => {
    if (typeof item !== "string" || !item.trim()) {
      throw new DomainError(
        DomainError.codes.INVALID_ACTOR,
        `items[${index}] must be a non-empty string`
      );
    }
    return item.trim();
  });
};

export class Actor {
  constructor({
    id,
    name,
    ownerUserId,
    abilities,
    profBonus,
    maxHP,
    ac,
    items,
  }) {
    this.id = ensureNonEmptyString(id, "id");
    this.name = ensureNonEmptyString(name, "name");
    this.ownerUserId = ensureNonEmptyString(ownerUserId, "ownerUserId");
    this.abilities = normalizeAbilities(abilities);
    this.profBonus = ensureIntegerInRange(profBonus, "profBonus", { min: 0, max: 6 });
    this.maxHP = ensureNonNegativeInteger(maxHP, "maxHP");
    this.ac = ensureIntegerInRange(ac, "ac", { min: 1, max: 30 });
    this.items = normalizeItems(items);
  }

  withUpdates({ name, ownerUserId, abilities, profBonus, maxHP, ac, items }) {
    const nextAbilities = abilities
      ? normalizeAbilities(abilities, this.abilities)
      : this.abilities;

    return new Actor({
      id: this.id,
      name: name !== undefined ? ensureNonEmptyString(name, "name") : this.name,
      ownerUserId:
        ownerUserId !== undefined
          ? ensureNonEmptyString(ownerUserId, "ownerUserId")
          : this.ownerUserId,
      abilities: nextAbilities,
      profBonus:
        profBonus !== undefined
          ? ensureIntegerInRange(profBonus, "profBonus", { min: 0, max: 6 })
          : this.profBonus,
      maxHP:
        maxHP !== undefined
          ? ensureNonNegativeInteger(maxHP, "maxHP")
          : this.maxHP,
      ac:
        ac !== undefined
          ? ensureIntegerInRange(ac, "ac", { min: 1, max: 30 })
          : this.ac,
      items: items !== undefined ? normalizeItems(items) : this.items,
    });
  }
}
