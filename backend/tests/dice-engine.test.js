import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DiceEngine } from "#modules/dice/DiceEngine.js";

const createStubRandom = (values) => {
  let index = 0;
  return () => {
    if (index >= values.length) {
      return values[values.length - 1];
    }
    const value = values[index];
    index += 1;
    return value;
  };
};

describe("DiceEngine", () => {
  it("rolls complex expressions with static modifiers", () => {
    const engine = new DiceEngine({ randomSource: createStubRandom([0.25, 0.5]) });

    const result = engine.roll("2d6+3");

    assert.equal(result.total, 9);
    assert.equal(result.exprNorm, "2d6+3");
    assert.deepEqual(result.parts, [
      { type: "die", value: 2, sides: 6 },
      { type: "die", value: 4, sides: 6 },
      { type: "mod", value: 3 },
    ]);
  });

  it("supports single die expressions", () => {
    const engine = new DiceEngine({ randomSource: createStubRandom([0.9]) });

    const result = engine.roll("d20");

    assert.equal(result.total, 19);
    assert.equal(result.exprNorm, "1d20");
    assert.deepEqual(result.parts, [{ type: "die", value: 19, sides: 20 }]);
  });

  it("applies ability modifiers when actor context is provided", () => {
    const engine = new DiceEngine({ randomSource: createStubRandom([0.375]) });

    const mockActor = {
      abilities: {
        STR: 10,
        DEX: 16,
        CON: 10,
        INT: 10,
        WIS: 10,
        CHA: 10,
      },
      profBonus: 2,
    };

    const result = engine.roll("1d8+DEX", { actor: mockActor });

    assert.equal(result.total, 7);
    assert.equal(result.exprNorm, "1d8+DEX");
    assert.deepEqual(result.parts, [
      { type: "die", value: 4, sides: 8 },
      { type: "mod", value: 3 },
    ]);
  });
});
