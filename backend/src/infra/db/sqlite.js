import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const DEFAULT_DB_FILENAME = 'shrinevtt.sqlite';

// В контейнере данные хранятся в volume /app/data
const DATA_DIR = process.env.DATA_DIR || '/app/data';
const DB_PATH = path.join(DATA_DIR, DEFAULT_DB_FILENAME);

// Создать каталог для БД, если его нет
try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`[DB] Ensured data directory: ${DATA_DIR}`);
} catch (e) {
  console.error(`[DB] Failed to create data directory: ${DATA_DIR}`, e);
}

console.log(`[DB] Using SQLite DB: ${DB_PATH}`);

const db = new Database(DB_PATH);

// Настройки SQLite
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Инициализация таблиц
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
