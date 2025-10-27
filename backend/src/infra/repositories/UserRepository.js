import bcrypt from 'bcryptjs';

import { USER_ROLES } from '../../../../shared/auth.js';

/**
 * @typedef {import('../../../../shared/auth.js').User} User
 * @typedef {import('../../../../shared/auth.js').UserRole} UserRole
 */

const SALT_ROUNDS = 10;

function mapUserRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    passwordHash: row.passwordHash,
    role: row.role,
    createdAt: row.createdAt,
  };
}

export default class UserRepository {
  /**
   * @param {import('better-sqlite3').Database} db
   */
  constructor(db) {
    this.db = db;
    this.insertStmt = this.db.prepare(
      'INSERT INTO users (username, passwordHash, role) VALUES (@username, @passwordHash, @role)',
    );
    this.findByUsernameStmt = this.db.prepare(
      'SELECT id, username, passwordHash, role, createdAt FROM users WHERE username = ?',
    );
    this.findByIdStmt = this.db.prepare(
      'SELECT id, username, passwordHash, role, createdAt FROM users WHERE id = ?',
    );
  }

  /**
   * @param {string} username
   * @returns {(User & { passwordHash: string }) | null}
   */
  findByUsername(username) {
    return mapUserRow(this.findByUsernameStmt.get(username));
  }

  /**
   * @param {number} id
   * @returns {(User & { passwordHash: string }) | null}
   */
  findById(id) {
    return mapUserRow(this.findByIdStmt.get(id));
  }

  /**
   * @param {{ username: string; passwordHash: string; role: UserRole }} user
   * @returns {User & { passwordHash: string }}
   */
  createUser(user) {
    const info = this.insertStmt.run(user);
    return this.findById(Number(info.lastInsertRowid));
  }
}

/**
 * @param {UserRepository} userRepository
 * @param {{ logger?: import('pino').Logger }} [options]
 */
export function seedTestUsers(userRepository, { logger } = {}) {
  const seeds = [
    { username: 'master', password: 'master', role: USER_ROLES.MASTER },
    { username: 'player', password: 'player', role: USER_ROLES.PLAYER },
  ];

  for (const seed of seeds) {
    const existing = userRepository.findByUsername(seed.username);
    if (existing) {
      continue;
    }

    const passwordHash = bcrypt.hashSync(seed.password, SALT_ROUNDS);
    userRepository.createUser({
      username: seed.username,
      passwordHash,
      role: seed.role,
    });
    logger?.info({ username: seed.username, role: seed.role }, 'Seeded test user');
  }
}

/**
 * @param {(User & { passwordHash?: string }) | null} user
 * @returns {User | null}
 */
export function toPublicUser(user) {
  if (!user) {
    return null;
  }

  const { passwordHash: _ignored, ...rest } = user;
  return /** @type {User} */ (rest);
}
