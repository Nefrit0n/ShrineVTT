import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const dataDir = await mkdtemp(path.join(os.tmpdir(), "shrinevtt-actors-"));
process.env.DATA_DIR = dataDir;

const { initDatabase, getDatabase } = await import("#storage/db.js");
await initDatabase();

const { createApp } = await import("../src/app.js");
const { createApplicationContainer } = await import("../src/application/container.js");

const db = getDatabase();
const container = createApplicationContainer({ db });
const app = createApp(container);

const server = createServer(app);
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
  return { token: payload.token, user: payload.user };
};

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

test("Item API allows GM to create and share items", async () => {
  const { token: masterToken } = await login("master", "masterpass");
  const { token: playerToken } = await login("player", "playerpass");

  const createResponse = await fetch(`${baseUrl}/api/items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${masterToken}`,
    },
    body: JSON.stringify({
      name: "Rapier",
      type: "weapon",
      data: { damage: "1d8", ability: "DEX", finesse: true },
    }),
  });

  assert.equal(createResponse.status, 201);
  const createPayload = await createResponse.json();
  assert.ok(createPayload.item?.id);
  assert.equal(createPayload.item.data.ability, "DEX");

  const itemId = createPayload.item.id;

  const getResponse = await fetch(`${baseUrl}/api/items/${itemId}`, {
    headers: { Authorization: `Bearer ${playerToken}` },
  });

  assert.equal(getResponse.status, 200);
  const getPayload = await getResponse.json();
  assert.equal(getPayload.item.name, "Rapier");
  assert.equal(getPayload.item.data.damage, "1d8");
});

test("Actor API validates payloads and persists state", async () => {
  const { token: masterToken } = await login("master", "masterpass");
  const { token: playerToken, user: playerUser } = await login(
    "player",
    "playerpass"
  );

  const invalidResponse = await fetch(`${baseUrl}/api/actors`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${masterToken}`,
    },
    body: JSON.stringify({
      name: "Invalid Hero",
      ownerUserId: playerUser.id,
      abilities: { STR: 0, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
      profBonus: 2,
      maxHP: 12,
      ac: 15,
    }),
  });

  assert.equal(invalidResponse.status, 400);

  const itemResponse = await fetch(`${baseUrl}/api/items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${masterToken}`,
    },
    body: JSON.stringify({
      name: "Shield",
      type: "gear",
      data: { acBonus: 2 },
    }),
  });

  assert.equal(itemResponse.status, 201);
  const itemPayload = await itemResponse.json();
  const itemId = itemPayload.item.id;

  const createResponse = await fetch(`${baseUrl}/api/actors`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${masterToken}`,
    },
    body: JSON.stringify({
      name: "Aelar",
      ownerUserId: playerUser.id,
      abilities: {
        STR: 14,
        DEX: 16,
        CON: 12,
        INT: 10,
        WIS: 11,
        CHA: 13,
      },
      profBonus: 2,
      maxHP: 22,
      ac: 17,
      items: [itemId],
    }),
  });

  assert.equal(createResponse.status, 201);
  const createPayload = await createResponse.json();
  assert.ok(createPayload.actor?.id);
  assert.equal(createPayload.actor.items[0], itemId);

  const actorId = createPayload.actor.id;

  const getResponse = await fetch(`${baseUrl}/api/actors/${actorId}`, {
    headers: { Authorization: `Bearer ${playerToken}` },
  });

  assert.equal(getResponse.status, 200);
  const actorPayload = await getResponse.json();
  assert.equal(actorPayload.actor.name, "Aelar");
  assert.equal(actorPayload.actor.ac, 17);
  assert.equal(actorPayload.actor.abilities.STR, 14);

  const patchResponse = await fetch(`${baseUrl}/api/actors/${actorId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${playerToken}`,
    },
    body: JSON.stringify({ ac: 18, abilities: { DEX: 18 } }),
  });

  assert.equal(patchResponse.status, 200);
  const patchPayload = await patchResponse.json();
  assert.equal(patchPayload.actor.ac, 18);
  assert.equal(patchPayload.actor.abilities.DEX, 18);
  assert.equal(patchPayload.actor.abilities.STR, 14);

  const gmGetResponse = await fetch(`${baseUrl}/api/actors/${actorId}`, {
    headers: { Authorization: `Bearer ${masterToken}` },
  });
  assert.equal(gmGetResponse.status, 200);
  const gmPayload = await gmGetResponse.json();
  assert.equal(gmPayload.actor.ac, 18);
});
