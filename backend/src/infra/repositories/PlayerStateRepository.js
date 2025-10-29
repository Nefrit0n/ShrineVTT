function parseJson(value, fallback) {
  if (typeof value !== 'string' || !value.length) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch (err) {
    return fallback;
  }
}

export default class PlayerStateRepository {
  constructor(db) {
    if (!db) {
      throw new Error('db dependency is required');
    }

    this.db = db;

    this.insertOrIgnoreStmt = this.db.prepare(`
      INSERT OR IGNORE INTO player_state (sessionId, userId, username, tools, inventory, notes, actorId)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    this.updateUsernameStmt = this.db.prepare(`
      UPDATE player_state
      SET username = ?
      WHERE sessionId = ? AND userId = ?
    `);

    this.findByIdsStmt = this.db.prepare(`
      SELECT sessionId, userId, username, tools, inventory, notes, actorId
      FROM player_state
      WHERE sessionId = ? AND userId = ?
    `);

    this.updateNotesStmt = this.db.prepare(`
      UPDATE player_state
      SET notes = ?
      WHERE sessionId = ? AND userId = ?
    `);

    this.reassignUserStmt = this.db.prepare(`
      UPDATE player_state
      SET userId = ?, username = ?
      WHERE sessionId = ? AND userId = ?
    `);
  }

  ensurePlayerState({ sessionId, userId, username }) {
    if (!sessionId || !userId) {
      throw new Error('sessionId and userId are required');
    }

    const normalizedUsername = typeof username === 'string' && username.length ? username : 'Игрок';

    this.insertOrIgnoreStmt.run(
      sessionId,
      userId,
      normalizedUsername,
      '[]',
      '[]',
      '',
      null,
    );

    this.updateUsernameStmt.run(normalizedUsername, sessionId, userId);

    return this.getBySessionAndUser(sessionId, userId);
  }

  getBySessionAndUser(sessionId, userId) {
    if (!sessionId || !userId) return null;
    const row = this.findByIdsStmt.get(sessionId, userId);
    if (!row) return null;

    return {
      sessionId: row.sessionId,
      userId: row.userId,
      username: row.username,
      tools: parseJson(row.tools, []),
      inventory: parseJson(row.inventory, []),
      notes: typeof row.notes === 'string' ? row.notes : '',
      actorId: row.actorId ?? null,
    };
  }

  updateNotes({ sessionId, userId, notes }) {
    if (!sessionId || !userId) {
      throw new Error('sessionId and userId are required for updateNotes');
    }

    const normalizedNotes = typeof notes === 'string' ? notes : '';
    const info = this.updateNotesStmt.run(normalizedNotes, sessionId, userId);

    if (info.changes === 0) {
      return null;
    }

    return this.getBySessionAndUser(sessionId, userId);
  }

  reassignUserState({ sessionId, fromUserId, toUserId, username }) {
    if (!sessionId || !fromUserId || !toUserId) {
      throw new Error('sessionId, fromUserId and toUserId are required to reassign player state');
    }

    if (fromUserId === toUserId) {
      return false;
    }

    const existingTarget = this.getBySessionAndUser(sessionId, toUserId);
    if (existingTarget) {
      return false;
    }

    const normalizedUsername = typeof username === 'string' && username.length ? username : 'Игрок';
    const info = this.reassignUserStmt.run(toUserId, normalizedUsername, sessionId, fromUserId);
    return info.changes > 0;
  }
}

