import { Router } from 'express';
import bcrypt from 'bcryptjs';

import { USER_ROLES } from '../../../../shared/auth.js';

const VALID_ROLES = new Set(Object.values(USER_ROLES));

/**
 * @param {{
 *  userRepository: import('../../infra/repositories/UserRepository.js').default;
 *  jwt: typeof import('../../auth/jwt.js');
 *  logger?: import('pino').Logger;
 * }} dependencies
 */
export default function createAuthRouter({ userRepository, jwt, logger }) {
  if (!userRepository) {
    throw new Error('userRepository dependency is required');
  }
  if (!jwt) {
    throw new Error('jwt dependency is required');
  }

  const router = Router();

  router.post('/login', async (req, res, next) => {
    try {
      const { username, password, role } = req.body ?? {};

      if (typeof username !== 'string' || username.trim() === '') {
        return res.status(400).json({ error: 'Username is required' });
      }

      if (typeof password !== 'string' || password === '') {
        return res.status(400).json({ error: 'Password is required' });
      }

      const normalizedUsername = username.trim();

      const userRecord = userRepository.findByUsername(normalizedUsername);

      if (!userRecord) {
        logger?.warn({ username: normalizedUsername }, 'Login failed: user not found');
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      if (role && !VALID_ROLES.has(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      if (role && role !== userRecord.role) {
        logger?.warn(
          { username: normalizedUsername, requestedRole: role, actualRole: userRecord.role },
          'Login role mismatch',
        );
        return res.status(403).json({ error: 'Role mismatch' });
      }

      const passwordMatches = await bcrypt.compare(password, userRecord.passwordHash);

      if (!passwordMatches) {
        logger?.warn({ username: normalizedUsername }, 'Login failed: password mismatch');
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const user = {
        id: userRecord.id,
        username: userRecord.username,
        role: userRecord.role,
      };

      const token = jwt.signUser(user);

      logger?.info({ userId: user.id, username: user.username, role: user.role }, 'User logged in');

      return res.json({ token, user });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
