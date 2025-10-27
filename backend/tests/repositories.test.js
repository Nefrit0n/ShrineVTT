import test from "node:test";
import assert from "node:assert/strict";

import { Scene } from "#domain/entities/Scene.js";
import { Token } from "#domain/entities/Token.js";
import { Actor } from "#domain/entities/Actor.js";
import { Item } from "#domain/entities/Item.js";
import { sceneToRecord } from "#domain/mappers/sceneMapper.js";
import { SceneRepository } from "#infra/repositories/SceneRepository.js";
import { TokenRepository } from "#infra/repositories/TokenRepository.js";
import { ActorRepository } from "#infra/repositories/ActorRepository.js";
import { ItemRepository } from "#infra/repositories/ItemRepository.js";

class InMemoryDatabase {
  constructor(initialData = {}) {
    this.data = structuredClone(initialData);
  }

  async read() {
    return this.data;
  }

  async write() {
    return this.data;
  }
}

test("SceneRepository supports CRUD with pagination", async () => {
  const db = new InMemoryDatabase({ scenes: [] });
  const repo = new SceneRepository(db);

  const scene = new Scene({
    id: "scene-1",
    roomId: "room-1",
    name: "First Scene",
    gridSize: 50,
    widthPx: 500,
    heightPx: 500,
  });

  await repo.create(scene);
  const fetched = await repo.findById(scene.id);
  assert.equal(fetched?.id, scene.id);

  const updated = scene.withGridSize(75);
  await repo.update(updated);
  const fetchedUpdated = await repo.findById(scene.id);
  assert.equal(fetchedUpdated?.gridSize, 75);

  const otherScenes = [
    new Scene({
      id: "scene-2",
      roomId: "room-1",
      name: "Second Scene",
      gridSize: 50,
      widthPx: 600,
      heightPx: 600,
    }),
    new Scene({
      id: "scene-3",
      roomId: "room-2",
      name: "Third Scene",
      gridSize: 40,
      widthPx: 400,
      heightPx: 400,
    }),
  ];

  for (const item of otherScenes) {
    await repo.create(item);
  }

  const roomScenes = await repo.listByRoom("room-1", { limit: 2, offset: 0 });
  assert.equal(roomScenes.length, 2);
  assert.ok(roomScenes.every((entry) => entry.roomId === "room-1"));

  const deleted = await repo.delete("scene-2");
  assert.equal(deleted, true);
  assert.equal((await repo.findById("scene-2")) === null, true);
});

test("TokenRepository stores tokens scoped by room and scene", async () => {
  const sceneA = new Scene({
    id: "scene-1",
    roomId: "room-1",
    name: "Room 1",
    gridSize: 50,
    widthPx: 500,
    heightPx: 500,
  });
  const sceneB = new Scene({
    id: "scene-2",
    roomId: "room-2",
    name: "Room 2",
    gridSize: 50,
    widthPx: 500,
    heightPx: 500,
  });

  const db = new InMemoryDatabase({
    scenes: [sceneToRecord(sceneA), sceneToRecord(sceneB)],
    tokens: [],
  });

  const repo = new TokenRepository(db);

  const tokenA1 = Token.create(
    {
      id: "token-1",
      sceneId: sceneA.id,
      ownerUserId: "user-1",
      name: "Hero",
      xCell: 1,
      yCell: 1,
    },
    sceneA
  );

  const tokenA2 = Token.create(
    {
      id: "token-2",
      sceneId: sceneA.id,
      ownerUserId: "user-2",
      name: "Mage",
      xCell: 2,
      yCell: 2,
    },
    sceneA
  );

  const tokenB1 = Token.create(
    {
      id: "token-3",
      sceneId: sceneB.id,
      ownerUserId: "user-3",
      name: "Rogue",
      xCell: 3,
      yCell: 3,
    },
    sceneB
  );

  await repo.create(tokenA1);
  await repo.create(tokenA2);
  await repo.create(tokenB1);

  const byScene = await repo.listByScene(sceneA.id, { limit: 1, offset: 1 });
  assert.equal(byScene.length, 1);
  assert.equal(byScene[0].id, tokenA2.id);

  const byRoom = await repo.listByRoom("room-1");
  assert.equal(byRoom.length, 2);
  assert.ok(byRoom.every((token) => token.sceneId === sceneA.id));

  const fetched = await repo.findById(tokenA1.id);
  assert.equal(fetched?.name, "Hero");

  const moved = tokenA1.withPosition({ xCell: 4, yCell: 4 }, sceneA);
  await repo.update(moved);
  const fetchedMoved = await repo.findById(tokenA1.id);
  assert.equal(fetchedMoved?.xCell, 4);

  const deleted = await repo.delete(tokenA2.id);
  assert.equal(deleted, true);
  const missing = await repo.findById(tokenA2.id);
  assert.equal(missing, null);
});

test("ActorRepository stores and filters actors by owner", async () => {
  const db = new InMemoryDatabase({ actors: [] });
  const repo = new ActorRepository(db);

  const actorA = new Actor({
    id: "actor-1",
    name: "Arannis",
    ownerUserId: "player-1",
    abilities: { STR: 12, DEX: 14, CON: 13, INT: 10, WIS: 11, CHA: 9 },
    profBonus: 2,
    maxHP: 18,
    ac: 16,
    items: ["item-1"],
  });

  const actorB = new Actor({
    id: "actor-2",
    name: "Belinda",
    ownerUserId: "player-2",
    abilities: { STR: 8, DEX: 12, CON: 10, INT: 14, WIS: 15, CHA: 13 },
    profBonus: 3,
    maxHP: 22,
    ac: 17,
  });

  await repo.create(actorA);
  await repo.create(actorB);

  const fetched = await repo.findById(actorA.id);
  assert.equal(fetched?.name, "Arannis");

  const byOwner = await repo.listByOwner("player-1");
  assert.equal(byOwner.length, 1);
  assert.equal(byOwner[0].id, actorA.id);

  const paginated = await repo.list({ offset: 1, limit: 1 });
  assert.equal(paginated.length, 1);

  const updated = actorA.withUpdates({ maxHP: 20 });
  await repo.update(updated);
  const fetchedUpdated = await repo.findById(actorA.id);
  assert.equal(fetchedUpdated?.maxHP, 20);

  const deleted = await repo.delete(actorB.id);
  assert.equal(deleted, true);
  assert.equal(await repo.findById(actorB.id), null);
});

test("ItemRepository provides CRUD with pagination", async () => {
  const db = new InMemoryDatabase({ items: [] });
  const repo = new ItemRepository(db);

  const sword = new Item({
    id: "item-1",
    name: "Longsword",
    type: "weapon",
    data: { damage: "1d8", ability: "STR" },
  });

  const rope = new Item({
    id: "item-2",
    name: "Silk Rope",
    type: "gear",
    data: { length: 50 },
  });

  await repo.create(sword);
  await repo.create(rope);

  const fetched = await repo.findById("item-1");
  assert.equal(fetched?.data.damage, "1d8");

  const list = await repo.list({ offset: 0, limit: 1 });
  assert.equal(list.length, 1);

  const updated = sword.withUpdates({
    data: { damage: "1d8", ability: "DEX", finesse: true },
  });
  await repo.update(updated);
  const fetchedUpdated = await repo.findById("item-1");
  assert.equal(fetchedUpdated?.data.ability, "DEX");

  const deleted = await repo.delete("item-2");
  assert.equal(deleted, true);
  assert.equal(await repo.findById("item-2"), null);
});
