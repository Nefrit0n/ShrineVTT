import { DomainError } from "#domain/errors/DomainError.js";
import { ABILITY_KEYS } from "#domain/entities/Actor.js";

const MAX_DICE_COUNT = 100;
const MAX_DICE_SIDES = 1000;
const DICE_TERM_REGEX = /^(\d*)d(\d+)$/i;
const TOKEN_REGEX = /[+-]?[^+-]+/g;

const ABILITIES = new Set(ABILITY_KEYS);
const SPECIAL_MODIFIERS = new Set(["PROF"]);

const createSeededRandom = (seed) => {
  if (seed === undefined || seed === null) {
    return () => Math.random();
  }

  const source = String(seed);
  let state = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    state ^= source.charCodeAt(index);
    state = Math.imul(state, 16777619);
    state >>>= 0;
  }

  return () => {
    state = Math.imul(state ^ (state >>> 15), 2246822507);
    state = Math.imul(state ^ (state >>> 13), 3266489909);
    state ^= state >>> 16;
    return (state >>> 0) / 4294967296;
  };
};

const computeAbilityModifier = (actor, abilityKey) => {
  if (!actor) {
    throw new DomainError(
      DomainError.codes.INVALID_ROLL,
      `Expression references ability ${abilityKey} but no actor was provided`
    );
  }

  const abilities = actor.abilities ?? actor.abilityScores ?? null;
  if (!abilities || typeof abilities !== "object") {
    throw new DomainError(
      DomainError.codes.INVALID_ROLL,
      `Actor does not provide ability scores required for ${abilityKey}`
    );
  }

  const score = Number(abilities[abilityKey]);
  if (!Number.isFinite(score)) {
    throw new DomainError(
      DomainError.codes.INVALID_ROLL,
      `Actor is missing ability score ${abilityKey}`
    );
  }

  return Math.floor((score - 10) / 2);
};

const computeSpecialModifier = (actor, key) => {
  if (key === "PROF") {
    if (!actor) {
      throw new DomainError(
        DomainError.codes.INVALID_ROLL,
        "Actor must provide profBonus when PROF modifier is used"
      );
    }

    const profBonus = Number(actor.profBonus);
    if (!Number.isFinite(profBonus)) {
      throw new DomainError(
        DomainError.codes.INVALID_ROLL,
        "Actor must provide profBonus when PROF modifier is used"
      );
    }
    return profBonus;
  }

  throw new DomainError(
    DomainError.codes.INVALID_ROLL,
    `Unknown modifier token: ${key}`
  );
};

const rollDie = (sides, randomSource) => {
  const value = randomSource();
  const normalized = Number.isFinite(value) ? Math.max(Math.min(value, 0.999999999), 0) : Math.random();
  return Math.floor(normalized * sides) + 1;
};

export class DiceEngine {
  #defaultRandomSource;

  constructor({ randomSource } = {}) {
    this.#defaultRandomSource = randomSource ?? (() => Math.random());
  }

  roll(expression, { actor = null, seed = undefined, randomSource } = {}) {
    if (typeof expression !== "string" || !expression.trim()) {
      throw new DomainError(
        DomainError.codes.INVALID_ROLL,
        "Dice expression must be a non-empty string"
      );
    }

    const sanitized = expression.replace(/\s+/g, "");
    const tokens = sanitized.match(TOKEN_REGEX);

    if (!tokens || tokens.length === 0) {
      throw new DomainError(
        DomainError.codes.INVALID_ROLL,
        "Dice expression is malformed"
      );
    }

    const rng =
      randomSource ?? (seed !== undefined ? createSeededRandom(seed) : this.#defaultRandomSource);

    const parts = [];
    let total = 0;
    let hasDice = false;
    const normalizedTokens = [];

    for (const rawToken of tokens) {
      let sign = 1;
      let token = rawToken;
      if (token.startsWith("+")) {
        token = token.slice(1);
      } else if (token.startsWith("-")) {
        sign = -1;
        token = token.slice(1);
      }

      if (!token) {
        throw new DomainError(
          DomainError.codes.INVALID_ROLL,
          "Dice expression contains empty terms"
        );
      }

      const diceMatch = token.match(DICE_TERM_REGEX);
      if (diceMatch) {
        hasDice = true;
        const count = diceMatch[1] ? Number(diceMatch[1]) : 1;
        const sides = Number(diceMatch[2]);

        if (!Number.isInteger(count) || count < 1) {
          throw new DomainError(
            DomainError.codes.INVALID_ROLL,
            "Dice count must be an integer greater than or equal to 1"
          );
        }

        if (!Number.isInteger(sides) || sides < 2) {
          throw new DomainError(
            DomainError.codes.INVALID_ROLL,
            "Dice sides must be an integer greater than or equal to 2"
          );
        }

        if (count > MAX_DICE_COUNT) {
          throw new DomainError(
            DomainError.codes.INVALID_ROLL,
            `Dice count exceeds maximum allowed (${MAX_DICE_COUNT})`
          );
        }

        if (sides > MAX_DICE_SIDES) {
          throw new DomainError(
            DomainError.codes.INVALID_ROLL,
            `Dice sides exceed maximum allowed (${MAX_DICE_SIDES})`
          );
        }

        const normalizedCount = count === 1 ? "1" : String(count);
        normalizedTokens.push({ sign, text: `${normalizedCount}d${sides}` });

        for (let index = 0; index < count; index += 1) {
          const roll = rollDie(sides, rng);
          const contribution = sign * roll;
          parts.push({ type: "die", value: contribution, sides });
          total += contribution;
        }

        continue;
      }

      const upper = token.toUpperCase();
      if (ABILITIES.has(upper)) {
        const modifier = computeAbilityModifier(actor, upper);
        const contribution = sign * modifier;
        parts.push({ type: "mod", value: contribution });
        normalizedTokens.push({ sign, text: upper });
        total += contribution;
        continue;
      }

      if (SPECIAL_MODIFIERS.has(upper)) {
        const modifier = computeSpecialModifier(actor, upper);
        const contribution = sign * modifier;
        parts.push({ type: "mod", value: contribution });
        normalizedTokens.push({ sign, text: upper });
        total += contribution;
        continue;
      }

      const numeric = Number(token);
      if (Number.isInteger(numeric)) {
        const contribution = sign * numeric;
        parts.push({ type: "mod", value: contribution });
        normalizedTokens.push({ sign, text: String(Math.abs(numeric)) });
        total += contribution;
        continue;
      }

      throw new DomainError(
        DomainError.codes.INVALID_ROLL,
        `Unknown token in dice expression: ${token}`
      );
    }

    if (!hasDice) {
      throw new DomainError(
        DomainError.codes.INVALID_ROLL,
        "Dice expression must include at least one dice term"
      );
    }

    const exprNorm = normalizedTokens
      .map((entry, index) => {
        const prefix = entry.sign < 0 ? "-" : index === 0 ? "" : "+";
        return `${prefix}${entry.text}`;
      })
      .join("");

    return { total, parts, exprNorm };
  }
}

export default DiceEngine;
