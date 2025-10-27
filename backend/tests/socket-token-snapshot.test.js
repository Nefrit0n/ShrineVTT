import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { io as createClient } from "socket.io-client";

const dataDir = await mkdtemp(path.join(os.tmpdir(), "shrinevtt-socket-snap-"));
process.env.DATA_DIR = dataDir;

const { initDatabase, getDatabase } = await import("#storage/db.js");
await initDatabase();

const { createApplicationContainer } = await import("../src/application/container.js");
const { createApp } = await import("../src/app.js");
const { initSocketServer } = await import("#socket/index.js");

const container = createApplicationContainer();
const app = createApp(container);

const server = createServer(app);
const ioServer = initSocketServer(server, container);

await new Promise((resolve) => {
  server.listen(0, "127.0.0.1", resolve);
});

const address = server.address();
const baseUrl = `http://${address.address}:${address.port}`;

const login = async (username, password) => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  assert.equal(response.status, 200, `Login failed for ${username}`);
  const payload = await response.json();
  return payload;
};

test.after(async () => {
  await new Promise((resolve) => {
    ioServer.close(() => resolve());
  });

  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  await rm(dataDir, { recursive: true, force: true });
});

test("Newly connected clients receive persisted tokens in scene snapshot", async () => {
  const masterLogin = await login("master", "masterpass");
  const playerLogin = await login("player", "playerpass");

  const db = getDatabase();
  const roomId = "socket-room-snapshot";
  const masterSession = db.data.sessions.find((session) => session.id === masterLogin.token);
  const playerSession = db.data.sessions.find((session) => session.id === playerLogin.token);
  masterSession.roomId = roomId;
  playerSession.roomId = roomId;
  await db.write();

  const createSceneResponse = await fetch(`${baseUrl}/api/scenes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${masterLogin.token}`,
    },
    body: JSON.stringify({
      name: "Snapshot Scene",
      gridSize: 50,
      widthPx: 600,
      heightPx: 400,
    }),
  });

  assert.equal(createSceneResponse.status, 201);
  const scenePayload = await createSceneResponse.json();
  const sceneId = scenePayload.scene.id;

  const masterSocket = createClient(`${baseUrl}/game`, {
    auth: { token: masterLogin.token, sessionId: "default" },
    transports: ["websocket"],
  });

  const masterConnectedPromise = once(masterSocket, "connected");
  const masterSnapshotPromise = once(masterSocket, "scene.snapshot");

  await once(masterSocket, "connect");
  const [masterHandshake] = await masterConnectedPromise;
  assert.equal(masterHandshake.roomId, roomId);
  await masterSnapshotPromise;

  const createAck = await new Promise((resolve) => {
    masterSocket.emit(
      "token.create:in",
      {
        sceneId,
        name: "Guardian",
        xCell: 3,
        yCell: 4,
        ownerUserId: masterHandshake.user?.id ?? masterLogin.user.id,
      },
      (response) => resolve(response)
    );
  });

  assert.ok(createAck?.ok, `Token creation failed: ${createAck?.error?.message ?? "unknown"}`);
  const tokenId = createAck.token.id;

  const playerSocket = createClient(`${baseUrl}/game`, {
    auth: { token: playerLogin.token, sessionId: "default" },
    transports: ["websocket"],
  });

  const playerConnectedPromise = once(playerSocket, "connected");
  const playerSnapshotPromise = once(playerSocket, "scene.snapshot");

  await once(playerSocket, "connect");
  const [playerHandshake] = await playerConnectedPromise;
  assert.equal(playerHandshake.roomId, roomId);

  const [snapshot] = await playerSnapshotPromise;
  assert.ok(snapshot.scene, "Snapshot should include scene data");
  assert.equal(snapshot.scene.id, sceneId);
  assert.ok(Array.isArray(snapshot.tokens), "Snapshot tokens should be an array");

  const receivedToken = snapshot.tokens.find((token) => token.id === tokenId);
  assert.ok(receivedToken, "Snapshot should include created token");
  assert.equal(receivedToken?.name, "Guardian");
  assert.equal(receivedToken?.xCell, 3);
  assert.equal(receivedToken?.yCell, 4);

  masterSocket.close();
  playerSocket.close();
});
