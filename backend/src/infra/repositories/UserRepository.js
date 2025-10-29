import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

function normalizeUsername(raw) {
  if (typeof raw !== 'string') {
    return '';
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }

  return trimmed.slice(0, 64);
}

function toUserEntity(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id !== undefined && row.id !== null ? String(row.id) : null,
    username: row.username,
    role: row.role,
    passwordHash: row.passwordHash,
  };
}

export default class UserRepository {
  constructor(db) {
    this.db = db;
  }

  findByUsername(username) {
    const normalized = normalizeUsername(username);
    if (!normalized) {
      return null;
    }

    const sql = `
      SELECT id, username, role, passwordHash
      FROM users
      WHERE lower(username) = lower(?)
    `;
    const row = this.db.prepare(sql).get(normalized);
    return toUserEntity(row);
  }

  insertUser({ username, passwordHash, role }) {
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) {
      throw new Error('Username is required to insert user');
    }

    if (typeof passwordHash !== 'string' || passwordHash.length === 0) {
      throw new Error('passwordHash is required to insert user');
    }

    const normalizedRole = typeof role === 'string' ? role.toUpperCase() : 'PLAYER';
    const sql = `
      INSERT INTO users (username, passwordHash, role)
      VALUES (?, ?, ?)
    `;
    const info = this.db.prepare(sql).run(normalizedUsername, passwordHash, normalizedRole);
    return {
      id: info.lastInsertRowid !== undefined && info.lastInsertRowid !== null
        ? String(info.lastInsertRowid)
        : null,
      username: normalizedUsername,
      role: normalizedRole,
    };
  }

  ensurePlayerUser(username) {
    const normalized = normalizeUsername(username);
    if (!normalized) {
      throw new Error('Username is required to ensure player user');
    }

    const existing = this.findByUsername(normalized);
    if (existing) {
      return existing;
    }

    const passwordSource = crypto.randomUUID();
    const passwordHash = bcrypt.hashSync(passwordSource, 10);
    const created = this.insertUser({ username: normalized, passwordHash, role: 'PLAYER' });
    return created;
  }
}

export function seedTestUsers(userRepository, { logger }) {
  const players = [
    { username: 'player1', password: 'player1', role: 'PLAYER' },
    { username: 'player2', password: 'player2', role: 'PLAYER' },
  ];

  for (const { username, password, role } of players) {
    const exists = userRepository.findByUsername(username);
    if (!exists) {
      const passwordHash = bcrypt.hashSync(password, 10);
      userRepository.insertUser({ username, passwordHash, role });
      logger.info({ username, role }, 'Seed player created');
    }
  }
}
