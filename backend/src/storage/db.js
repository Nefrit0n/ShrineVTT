import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { nanoid } from "nanoid";

import { getConfig } from "#config/index.js";

let dbInstance;

const defaultData = {
  users: [
    {
      id: "master-1",
      username: "master",
      password: "masterpass",
      role: "MASTER",
    },
    {
      id: "player-1",
      username: "player",
      password: "playerpass",
      role: "PLAYER",
    },
  ],
  sessions: [],
  scenes: [],
  tokens: [],
};

const ensureDefaults = (data) => {
  data.users ??= structuredClone(defaultData.users);
  data.sessions ??= [];
  data.scenes ??= [];
  data.tokens ??= [];
};

const maybeSeedDatabase = (db, { seedTestScene, defaultRoomId }) => {
  if (!seedTestScene) {
    return false;
  }

  const scenes = Array.isArray(db.data.scenes) ? db.data.scenes : [];
  const tokens = Array.isArray(db.data.tokens) ? db.data.tokens : [];

  if (scenes.length > 0 || tokens.length > 0) {
    return false;
  }

  const sceneId = "scene-demo";
  const heroTokenId = "token-hero";
  const allyTokenId = "token-ally";
  const roomId = defaultRoomId ?? "default";

  scenes.push({
    id: sceneId,
    roomId,
    name: "Demo Battlefield",
    gridSize: 64,
    mapImage: null,
    widthPx: 2048,
    heightPx: 1536,
  });

  tokens.push(
    {
      id: heroTokenId,
      sceneId,
      ownerUserId: "master-1",
      name: "Archon",
      xCell: 5,
      yCell: 7,
      sprite: null,
      visibility: "PUBLIC",
      meta: {},
    },
    {
      id: allyTokenId,
      sceneId,
      ownerUserId: "player-1",
      name: "Companion",
      xCell: 8,
      yCell: 4,
      sprite: null,
      visibility: "PUBLIC",
      meta: {},
    }
  );

  const sessions = Array.isArray(db.data.sessions) ? db.data.sessions : [];
  if (!sessions.find((session) => session.userId === "master-1")) {
    sessions.push({
      id: nanoid(16),
      userId: "master-1",
      createdAt: new Date().toISOString(),
      roomId,
    });
  }

  if (!sessions.find((session) => session.userId === "player-1")) {
    sessions.push({
      id: nanoid(16),
      userId: "player-1",
      createdAt: new Date().toISOString(),
      roomId,
    });
  }

  return true;
};

export const initDatabase = async () => {
  if (dbInstance) {
    return dbInstance;
  }

  const config = getConfig();
  const { dataDir, seedTestScene, defaultRoomId } = config;
  const dbPath = path.join(dataDir, "db.json");

  if (!existsSync(dataDir)) {
    await mkdir(dataDir, { recursive: true });
  }

  const adapter = new JSONFile(dbPath);
  dbInstance = new Low(adapter, defaultData);
  await dbInstance.read();

  if (!dbInstance.data) {
    dbInstance.data = structuredClone(defaultData);
  }

  ensureDefaults(dbInstance.data);

  maybeSeedDatabase(dbInstance, { seedTestScene, defaultRoomId });

  await dbInstance.write();

  return dbInstance;
};

export const getDatabase = () => {
  if (!dbInstance) {
    throw new Error("Database is not initialised. Call initDatabase() first.");
  }

  return dbInstance;
};
