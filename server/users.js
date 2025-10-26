import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USERS_FILE = path.resolve(__dirname, 'data/users.json');

async function loadUsers() {
  const fileContents = await readFile(USERS_FILE, 'utf-8');
  return JSON.parse(fileContents);
}

export async function findUserByEmail(email) {
  const users = await loadUsers();
  return users.find((user) => user.email.toLowerCase() === email.toLowerCase());
}

export async function getUserById(id) {
  const users = await loadUsers();
  return users.find((user) => user.id === id);
}
