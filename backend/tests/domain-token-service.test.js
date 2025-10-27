import test from "node:test";
import assert from "node:assert/strict";

import { Scene } from "#domain/entities/Scene.js";
import { Token } from "#domain/entities/Token.js";
import { DomainError } from "#domain/errors/DomainError.js";
import { TokenService } from "#domain/services/TokenService.js";

class StubSceneRepository {
  constructor(scene) {
    this.scene = scene;
  }

  async findById(id) {
    if (this.scene && this.scene.id === id) {
      return this.scene;
    }
    return null;
  }
}

class StubTokenRepository {
  constructor(token) {
    this.token = token;
    this.lastUpdated = null;
  }

  async findById(id) {
    if (this.token && this.token.id === id) {
      return this.token;
    }
    return null;
  }

  async update(token) {
    this.token = token;
    this.lastUpdated = token;
    return token;
  }
}

const createService = () => {
  const scene = new Scene({
    id: "scene-1",
    roomId: "room-1",
    name: "Battlefield",
    gridSize: 64,
    widthPx: 2048,
    heightPx: 2048,
  });

  const token = Token.create(
    {
      id: "token-1",
      sceneId: scene.id,
      ownerUserId: "player-1",
      name: "Hero",
      xCell: 0,
      yCell: 0,
    },
    scene
  );

  token.updatedAt = new Date(Date.now() - 1000).toISOString();

  const sceneRepository = new StubSceneRepository(scene);
  const tokenRepository = new StubTokenRepository(token);

  const service = new TokenService({ sceneRepository, tokenRepository });

  return { service, sceneRepository, tokenRepository };
};

test("TokenService rejects xCell out of bounds", async () => {
  const { service } = createService();

  await assert.rejects(
    () =>
      service.moveToken(
        "token-1",
        { xCell: 32, yCell: 0 },
        "player-1",
        { expectedVersion: 1 }
      ),
    (error) =>
      error instanceof DomainError &&
      error.code === DomainError.codes.OUT_OF_BOUNDS &&
      /xCell must be between 0 and 31/.test(error.message)
  );
});

test("TokenService rejects stale version", async () => {
  const scene = new Scene({
    id: "scene-stale",
    roomId: "room-1",
    name: "Arena",
    gridSize: 64,
    widthPx: 2048,
    heightPx: 2048,
  });

  const token = new Token({
    id: "token-stale",
    sceneId: scene.id,
    ownerUserId: "player-2",
    name: "Mage",
    xCell: 5,
    yCell: 5,
    version: 4,
    updatedAt: new Date().toISOString(),
  });

  const sceneRepository = new StubSceneRepository(scene);
  const tokenRepository = new StubTokenRepository(token);
  const service = new TokenService({ sceneRepository, tokenRepository });

  await assert.rejects(
    () =>
      service.moveToken(
        "token-stale",
        { xCell: 6, yCell: 6 },
        "player-2",
        { expectedVersion: 3 }
      ),
    (error) =>
      error instanceof DomainError &&
      error.code === DomainError.codes.STALE_UPDATE
  );
});

test("TokenService increments version and updatedAt on move", async () => {
  const { service, tokenRepository } = createService();
  const initialToken = await tokenRepository.findById("token-1");
  assert.ok(initialToken);

  const result = await service.moveToken(
    "token-1",
    { xCell: 1, yCell: 1 },
    "player-1",
    { expectedVersion: initialToken.version }
  );

  assert.equal(result.version, initialToken.version + 1);
  assert.equal(result.xCell, 1);
  assert.equal(result.yCell, 1);
  assert.notEqual(result.updatedAt, initialToken.updatedAt);

  const persisted = await tokenRepository.findById("token-1");
  assert.equal(persisted?.version, result.version);
  assert.equal(persisted?.updatedAt, result.updatedAt);
});
