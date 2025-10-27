import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { io as createClient } from "socket.io-client";

const dataDir = await mkdtemp(path.join(os.tmpdir(), "shrinevtt-socket-"));
process.env.DATA_DIR = dataDir;

const { initDatabase, getDatabase } = await import("#storage/db.js");
await initDatabase();

const { createApplicationContainer } = await import("../src/application/container.js");
const { createApp } = await import("../src/app.js");
const { initSocketServer } = await import("#socket/index.js");

const db = getDatabase();
const container = createApplicationContainer({ db });
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

test("Player can move owned token via websocket", async () => {
  const masterLogin = await login("master", "masterpass");
  const playerLogin = await login("player", "playerpass");

  const db = getDatabase();
  const roomId = "socket-room";
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
      name: "Socket Test Scene",
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

  const playerSocket = createClient(`${baseUrl}/game`, {
    auth: { token: playerLogin.token, sessionId: "default" },
    transports: ["websocket"],
  });

  const masterSnapshotPromise = once(masterSocket, "scene.snapshot");
  const playerSnapshotPromise = once(playerSocket, "scene.snapshot");

  const masterConnectedPromise = once(masterSocket, "connected");
  const playerConnectedPromise = once(playerSocket, "connected");

  await Promise.all([once(masterSocket, "connect"), once(playerSocket, "connect")]);

  const [masterHandshake] = await masterConnectedPromise;
  const [playerHandshake] = await playerConnectedPromise;

  assert.equal(masterHandshake.roomId, roomId);
  assert.equal(playerHandshake.roomId, roomId);

  await Promise.all([masterSnapshotPromise, playerSnapshotPromise]);

  try {
    const createOutPromise = once(playerSocket, "token.create:out");
    const createAck = await new Promise((resolve) => {
      masterSocket.emit(
        "token.create:in",
        {
          sceneId,
          name: "Scout",
          xCell: 1,
          yCell: 2,
          ownerUserId: playerHandshake.user?.id ?? playerLogin.user.id,
        },
        (response) => resolve(response)
      );
    });

    assert.ok(createAck?.ok, `Token creation failed: ${createAck?.error?.message ?? "unknown"}`);

    const [createOut] = await createOutPromise;
    assert.equal(createOut.token.name, "Scout");
    const tokenId = createAck.token.id;

    const moveBroadcastPromise = once(masterSocket, "token.move:out");
    const moveAck = await new Promise((resolve) => {
      playerSocket.emit(
        "token.move:in",
        {
          tokenId,
          xCell: 4,
          yCell: 5,
          version: createAck.token.version + 1,
          updatedAt: createAck.token.updatedAt,
        },
        (response) => resolve(response)
      );
    });

    assert.ok(moveAck?.ok, `Token move failed: ${moveAck?.error?.message ?? "unknown"}`);
    assert.equal(moveAck.token.xCell, 4);
    assert.equal(moveAck.token.yCell, 5);
    assert.equal(moveAck.token.version, createAck.token.version + 1);
    assert.notEqual(moveAck.token.updatedAt, createAck.token.updatedAt);

    const [moveOut] = await moveBroadcastPromise;
    assert.equal(moveOut.token.id, tokenId);
    assert.equal(moveOut.token.xCell, 4);
    assert.equal(moveOut.token.yCell, 5);
  } finally {
    masterSocket.close();
    playerSocket.close();
  }
});
