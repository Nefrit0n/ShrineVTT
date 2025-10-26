import { nanoid } from "nanoid";

import { getUserById } from "./authService.js";

import { getDatabase } from "#storage/db.js";

export const createSession = async (userId) => {
  const db = getDatabase();
  const token = nanoid(32);
  const session = {
    id: token,
    userId,
    createdAt: new Date().toISOString(),
  };

  db.data.sessions.push(session);
  await db.write();

  const user = await getUserById(userId);

  return { token, user };
};

export const getSessionByToken = async (token) => {
  const db = getDatabase();

  const session = db.data.sessions.find((item) => item.id === token);

  if (!session) {
    return null;
  }

  const user = await getUserById(session.userId);

  if (!user) {
    return null;
  }

  return { session, user };
};

export const deleteSession = async (token) => {
  const db = getDatabase();
  const index = db.data.sessions.findIndex((item) => item.id === token);

  if (index >= 0) {
    db.data.sessions.splice(index, 1);
    await db.write();
  }
};
