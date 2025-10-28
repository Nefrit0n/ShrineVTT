import crypto from 'node:crypto';
import { USER_ROLES } from '../../../../shared/auth.js';

const SESSION_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SESSION_CODE_LENGTH = 6;

function generateSessionCode() {
  const alphabetLength = SESSION_CODE_ALPHABET.length;
  const randomBytes = crypto.randomBytes(SESSION_CODE_LENGTH);
  let code = '';

  for (let i = 0; i < SESSION_CODE_LENGTH; i += 1) {
    const index = randomBytes[i] % alphabetLength;
    code += SESSION_CODE_ALPHABET[index];
  }

  return code;
}

export default class SessionRepository {
  constructor(db) {
    this.db = db;
    this.insertSessionStatement = this.db.prepare(`
      INSERT INTO sessions (id, code, masterUserId, createdAt)
      VALUES (?, ?, ?, ?)
    `);
    this.insertMemberStatement = this.db.prepare(`
      INSERT INTO session_members (sessionId, userId, role, username, joinedAt)
      VALUES (?, ?, ?, ?, ?)
    `);
    this.findByCodeStatement = this.db.prepare(`
      SELECT id, code, masterUserId, createdAt FROM sessions WHERE code = ?
    `);
  }

  /**
   * @param {{ masterUserId: string; masterUsername: string }} params
   * @returns {{ id: string; code: string; masterUserId: string; createdAt: string }}
   */
  createSession(params) {
    const masterUserId = String(params.masterUserId);
    const masterUsername = params.masterUsername;

    if (!masterUserId) {
      throw new Error('masterUserId is required');
    }
    if (!masterUsername) {
      throw new Error('masterUsername is required');
    }

    const sessionId = crypto.randomUUID();
    const transaction = this.db.transaction((id, code, masterId, masterName, createdAt) => {
      this.insertSessionStatement.run(id, code, masterId, createdAt);
      this.insertMemberStatement.run(id, masterId, USER_ROLES.MASTER, masterName, createdAt);
    });

    while (true) {
      const code = generateSessionCode();
      const createdAt = new Date().toISOString();
      try {
        transaction(sessionId, code, masterUserId, masterUsername, createdAt);
        return { id: sessionId, code, masterUserId, createdAt };
      } catch (error) {
        if (error && typeof error === 'object' && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          // Код сессии заняли — пробуем снова
          continue; // eslint-disable-line no-continue
        }
        throw error;
      }
    }
  }

  /**
   * @param {string} code
   * @returns {{ id: string; code: string; masterUserId: string; createdAt: string } | undefined}
   */
  findByCode(code) {
    if (!code) {
      return undefined;
    }
    return this.findByCodeStatement.get(code);
  }

  /**
   * @param {{ sessionId: string; username: string; role?: string }} params
   * @returns {{ sessionId: string; userId: string; role: string; username: string; joinedAt: string }}
   */
  addMember(params) {
    const { sessionId } = params;
    const username = params.username;
    const role = params.role ?? USER_ROLES.PLAYER;

    if (!sessionId) {
      throw new Error('sessionId is required');
    }
    if (!username) {
      throw new Error('username is required');
    }

    const userId = crypto.randomUUID();
    const joinedAt = new Date().toISOString();
    this.insertMemberStatement.run(sessionId, userId, role, username, joinedAt);

    return { sessionId, userId, role, username, joinedAt };
  }
}
