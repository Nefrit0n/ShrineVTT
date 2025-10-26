import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

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
};

export const initDatabase = async () => {
  if (dbInstance) {
    return dbInstance;
  }

  const { dataDir } = getConfig();
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

  await dbInstance.write();

  return dbInstance;
};

export const getDatabase = () => {
  if (!dbInstance) {
    throw new Error("Database is not initialised. Call initDatabase() first.");
  }

  return dbInstance;
};
