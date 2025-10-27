import test from "node:test";
import assert from "node:assert/strict";

import { Scene } from "#domain/entities/Scene.js";
import { Token } from "#domain/entities/Token.js";
import { Actor } from "#domain/entities/Actor.js";
import { Item } from "#domain/entities/Item.js";
import { DomainError } from "#domain/errors/DomainError.js";

test("Scene enforces positive grid size", () => {
  assert.throws(
    () =>
      new Scene({
        id: "scene-1",
        roomId: "room-1",
        name: "Test Scene",
        gridSize: 0,
        mapImage: null,
        widthPx: 800,
        heightPx: 600,
      }),
    (error) => error instanceof DomainError && error.code === DomainError.codes.INVALID_GRID
  );
});

test("Token creation rejects non-integer coordinates", () => {
  const scene = new Scene({
    id: "scene-1",
    roomId: "room-1",
    name: "Test Scene",
    gridSize: 50,
    mapImage: null,
    widthPx: 500,
    heightPx: 500,
  });

  assert.throws(
    () =>
      Token.create(
        {
          id: "token-1",
          sceneId: scene.id,
          ownerUserId: "user-1",
          name: "Hero",
          xCell: 2.6,
          yCell: 3.2,
        },
        scene
      ),
    (error) =>
      error instanceof DomainError && error.code === DomainError.codes.INVALID_GRID
  );
});

test("Token creation rejects out-of-bounds coordinates", () => {
  const scene = new Scene({
    id: "scene-1",
    roomId: "room-1",
    name: "Test Scene",
    gridSize: 50,
    mapImage: null,
    widthPx: 500,
    heightPx: 500,
  });

  assert.throws(
    () =>
      Token.create(
        {
          id: "token-1",
          sceneId: scene.id,
          ownerUserId: "user-1",
          name: "Hero",
          xCell: 20,
          yCell: 0,
        },
        scene
      ),
    (error) => error instanceof DomainError && error.code === DomainError.codes.OUT_OF_BOUNDS
  );
});

test("Actor enforces ability score boundaries", () => {
  assert.throws(
    () =>
      new Actor({
        id: "actor-1",
        name: "Hero",
        ownerUserId: "player-1",
        abilities: { STR: 0, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
        profBonus: 2,
        maxHP: 15,
        ac: 15,
      }),
    (error) =>
      error instanceof DomainError && error.code === DomainError.codes.INVALID_ACTOR
  );
});

test("Actor withUpdates validates provided changes", () => {
  const actor = new Actor({
    id: "actor-1",
    name: "Hero",
    ownerUserId: "player-1",
    abilities: { STR: 10, DEX: 12, CON: 14, INT: 8, WIS: 11, CHA: 9 },
    profBonus: 2,
    maxHP: 15,
    ac: 14,
    items: ["item-1"],
  });

  const updated = actor.withUpdates({ abilities: { STR: 18 }, maxHP: 20 });
  assert.equal(updated.abilities.STR, 18);
  assert.equal(updated.abilities.DEX, 12);
  assert.equal(updated.maxHP, 20);
});

test("Item enforces weapon data invariants", () => {
  assert.throws(
    () =>
      new Item({
        id: "item-1",
        name: "Greatsword",
        type: "weapon",
        data: { damage: "2d6", ability: "FOO" },
      }),
    (error) =>
      error instanceof DomainError && error.code === DomainError.codes.INVALID_ITEM
  );
});
