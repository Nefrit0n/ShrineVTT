import bcrypt from 'bcryptjs';

export default class UserRepository {
  constructor(db) {
    this.db = db;
  }

  findByUsername(username) {
    const sql = `SELECT id, username, role, passwordHash FROM users WHERE username = ?`;
    return this.db.prepare(sql).get(username);
  }

  insertUser({ username, passwordHash, role }) {
    const sql = `
      INSERT INTO users (username, passwordHash, role)
      VALUES (?, ?, ?)
    `;
    const info = this.db.prepare(sql).run(username, passwordHash, role);
    return { id: info.lastInsertRowid, username, role };
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
