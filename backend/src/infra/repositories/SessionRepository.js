import crypto from 'node:crypto';

const SESSION_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SESSION_CODE_LENGTH = 6;

function generateCode() {
  const bytes = crypto.randomBytes(SESSION_CODE_LENGTH);
  const alphabetLength = SESSION_CODE_ALPHABET.length;
  let code = '';

  for (let i = 0; i < SESSION_CODE_LENGTH; i += 1) {
    code += SESSION_CODE_ALPHABET[bytes[i] % alphabetLength];
  }

  return code;
}

export default class SessionRepository {
  constructor(db) {
    this.db = db;
    this.insertSessionStmt = this.db.prepare(`
      INSERT INTO sessions (id, code, masterUserId, createdAt)
      VALUES (?, ?, ?, ?)
    `);
    this.findSessionByCodeStmt = this.db.prepare(`
      SELECT id, code, masterUserId, createdAt
      FROM sessions
      WHERE code = ?
    `);
    this.findSessionByIdStmt = this.db.prepare(`
      SELECT id, code, masterUserId, createdAt
      FROM sessions
      WHERE id = ?
    `);
    this.insertMemberStmt = this.db.prepare(`
      INSERT OR REPLACE INTO session_members (sessionId, userId, role, username, joinedAt)
      VALUES (?, ?, ?, ?, ?)
    `);
    this.touchMemberStmt = this.db.prepare(`
      UPDATE session_members
      SET joinedAt = ?
      WHERE sessionId = ? AND userId = ?
    `);
    this.findMemberByUsernameStmt = this.db.prepare(`
      SELECT sessionId, userId, role, username, joinedAt
      FROM session_members
      WHERE sessionId = ? AND lower(username) = lower(?)
    `);
  }

  createSession({ masterUserId }) {
    const sessionId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = generateCode();

      try {
        this.insertSessionStmt.run(sessionId, code, masterUserId ?? null, createdAt);
        return { id: sessionId, code, masterUserId: masterUserId ?? null, createdAt };
      } catch (err) {
        if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          continue;
        }
        throw err;
      }
    }

    throw new Error('Failed to generate unique session code');
  }

  findByCode(code) {
    if (!code) return null;
    return this.findSessionByCodeStmt.get(code) ?? null;
  }

  findById(id) {
    if (!id) return null;
    return this.findSessionByIdStmt.get(id) ?? null;
  }

  upsertMember({ sessionId, userId, role, username }) {
    if (!sessionId || !userId) {
      throw new Error('sessionId and userId are required for upsertMember');
    }

    const joinedAt = new Date().toISOString();
    this.insertMemberStmt.run(sessionId, userId, role, username, joinedAt);
    return { sessionId, userId, role, username, joinedAt };
  }

  touchMember({ sessionId, userId }) {
    if (!sessionId || !userId) return false;
    const joinedAt = new Date().toISOString();
    const info = this.touchMemberStmt.run(joinedAt, sessionId, userId);
    return info.changes > 0 ? { sessionId, userId, joinedAt } : false;
  }

  findMemberByUsername(sessionId, username) {
    if (!sessionId || !username) return null;
    return this.findMemberByUsernameStmt.get(sessionId, username) ?? null;
  }
}

export function normalizeSessionCode(input) {
  if (!input) return null;
  const raw = String(input).trim().toUpperCase();
  if (raw.length !== SESSION_CODE_LENGTH) {
    return null;
  }

  for (let i = 0; i < raw.length; i += 1) {
    if (!SESSION_CODE_ALPHABET.includes(raw[i])) {
      return null;
    }
  }

  return raw;
}

export const SESSION_CODE_CHARSET = SESSION_CODE_ALPHABET;
