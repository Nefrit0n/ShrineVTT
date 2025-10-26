import test from "node:test";
import assert from "node:assert/strict";

import { Scene } from "#domain/entities/Scene.js";
import { Token } from "#domain/entities/Token.js";
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

test("Token creation normalises coordinates to integers", () => {
  const scene = new Scene({
    id: "scene-1",
    roomId: "room-1",
    name: "Test Scene",
    gridSize: 50,
    mapImage: null,
    widthPx: 500,
    heightPx: 500,
  });

  const token = Token.create(
    {
      id: "token-1",
      sceneId: scene.id,
      ownerUserId: "user-1",
      name: "Hero",
      xCell: 2.6,
      yCell: 3.2,
    },
    scene
  );

  assert.equal(token.xCell, 3);
  assert.equal(token.yCell, 3);
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
