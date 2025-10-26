import { getDatabase } from "#storage/db.js";

export const authenticateUser = async (username, password) => {
  const db = getDatabase();
  const user = db.data.users.find(
    (candidate) =>
      candidate.username === username && candidate.password === password
  );

  if (!user) {
    return null;
  }

  return { ...user };
};

export const getUserById = async (userId) => {
  const db = getDatabase();

  return db.data.users.find((user) => user.id === userId) ?? null;
};
