import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const dataDir = await mkdtemp(path.join(os.tmpdir(), "shrinevtt-scenes-"));
process.env.DATA_DIR = dataDir;

const { initDatabase, getDatabase } = await import("#storage/db.js");
await initDatabase();

const { default: app } = await import("../src/app.js");

const server = createServer(app);

await new Promise((resolve) => {
  server.listen(0, "127.0.0.1", resolve);
});

const address = server.address();
const baseUrl = `http://${address.address}:${address.port}`;

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

  await rm(dataDir, { recursive: true, force: true });
});

const login = async (username, password) => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  assert.equal(response.status, 200, `Login failed for ${username}`);
  const payload = await response.json();
  return payload.token;
};

test("Scene API allows GM to create, players to read and GM to update", async () => {
  const masterToken = await login("master", "masterpass");
  const playerToken = await login("player", "playerpass");

  const roomId = "room-alpha";
  const db = getDatabase();
  const masterSession = db.data.sessions.find((session) => session.id === masterToken);
  const playerSession = db.data.sessions.find((session) => session.id === playerToken);
  masterSession.roomId = roomId;
  playerSession.roomId = roomId;
  await db.write();

  const createResponse = await fetch(`${baseUrl}/api/scenes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${masterToken}`,
    },
    body: JSON.stringify({
      name: "Dungeon Entrance",
      gridSize: 50,
      widthPx: 800,
      heightPx: 600,
      mapImage: "data:image/png;base64,stub",
    }),
  });

  assert.equal(createResponse.status, 201);
  const createdPayload = await createResponse.json();
  assert.ok(createdPayload.scene?.id);
  assert.equal(createdPayload.scene.name, "Dungeon Entrance");
  assert.equal(createdPayload.scene.gridSize, 50);
  assert.equal(createdPayload.scene.widthPx, 800);
  assert.equal(createdPayload.scene.heightPx, 600);

  const sceneId = createdPayload.scene.id;

  const playerGet = await fetch(`${baseUrl}/api/scenes/${sceneId}?tokenLimit=10`, {
    method: "GET",
    headers: { Authorization: `Bearer ${playerToken}` },
  });

  assert.equal(playerGet.status, 200);
  const playerPayload = await playerGet.json();
  assert.equal(playerPayload.scene.id, sceneId);
  assert.deepEqual(playerPayload.tokens, []);

  const patchResponse = await fetch(`${baseUrl}/api/scenes/${sceneId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${masterToken}`,
    },
    body: JSON.stringify({ gridSize: 75, widthPx: 900 }),
  });

  assert.equal(patchResponse.status, 200);
  const patchedPayload = await patchResponse.json();
  assert.equal(patchedPayload.scene.gridSize, 75);
  assert.equal(patchedPayload.scene.widthPx, 900);
  assert.equal(patchedPayload.scene.heightPx, 600);

  const masterGet = await fetch(`${baseUrl}/api/scenes/${sceneId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${masterToken}` },
  });

  assert.equal(masterGet.status, 200);
  const masterPayload = await masterGet.json();
  assert.equal(masterPayload.scene.gridSize, 75);
  assert.equal(masterPayload.scene.widthPx, 900);
  assert.equal(masterPayload.scene.heightPx, 600);
});
