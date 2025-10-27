import { Actor } from "../entities/Actor.js";

const cloneAbilities = (abilities) => {
  if (abilities === null || abilities === undefined) {
    return undefined;
  }

  if (typeof structuredClone === "function") {
    return structuredClone(abilities);
  }

  return JSON.parse(JSON.stringify(abilities));
};

const cloneItems = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => String(item));
};

export const actorFromRecord = (record) => {
  if (!record) {
    return null;
  }

  return new Actor({
    ...record,
    abilities: cloneAbilities(record.abilities),
    items: cloneItems(record.items),
  });
};

export const actorToRecord = (actor) => ({
  id: actor.id,
  name: actor.name,
  ownerUserId: actor.ownerUserId,
  abilities: cloneAbilities(actor.abilities),
  profBonus: actor.profBonus,
  maxHP: actor.maxHP,
  ac: actor.ac,
  items: cloneItems(actor.items),
});

export const actorToDTO = actorToRecord;
