import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

const DEFAULT_DB_FILENAME = 'shrinevtt.sqlite';
const DB_PATH = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : path.resolve(process.cwd(), 'var', 'data', DEFAULT_DB_FILENAME);

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('MASTER', 'PLAYER')),
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export default db;
