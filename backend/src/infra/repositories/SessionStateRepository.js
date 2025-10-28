export default class SessionStateRepository {
  constructor(db) {
    if (!db) {
      throw new Error('db dependency is required');
    }

    this.db = db;
    this.getStateStmt = this.db.prepare(`
      SELECT sessionId, activeSceneId
      FROM session_state
      WHERE sessionId = ?
    `);
    this.upsertStateStmt = this.db.prepare(`
      INSERT INTO session_state (sessionId, activeSceneId)
      VALUES (?, ?)
      ON CONFLICT(sessionId) DO UPDATE SET activeSceneId = excluded.activeSceneId
    `);
  }

  get(sessionId) {
    if (!sessionId) return null;
    const row = this.getStateStmt.get(sessionId);
    if (!row) return null;
    return {
      sessionId: row.sessionId,
      activeSceneId: row.activeSceneId ?? null,
    };
  }

  setActiveScene({ sessionId, activeSceneId = null }) {
    if (!sessionId) {
      throw new Error('sessionId is required to set active scene');
    }

    this.upsertStateStmt.run(sessionId, activeSceneId ?? null);
    return { sessionId, activeSceneId: activeSceneId ?? null };
  }
}
