import test from "node:test";
import assert from "node:assert/strict";

import { Scene } from "#domain/entities/Scene.js";
import { Token } from "#domain/entities/Token.js";
import { sceneToRecord } from "#domain/mappers/sceneMapper.js";
import { SceneRepository } from "#infra/repositories/SceneRepository.js";
import { TokenRepository } from "#infra/repositories/TokenRepository.js";

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
