import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { USER_ROLES } from '../../../../shared/auth.js';

const VALID_ROLES = new Set(Object.values(USER_ROLES));

export default function createAuthRouter({ userRepository, jwt, logger }) {
  if (!userRepository) {
    throw new Error('userRepository dependency is required');
  }
  if (!jwt) {
    throw new Error('jwt dependency is required');
  }

  const router = Router();

  // GM LOGIN
  router.post('/gm-login', (req, res) => {
    const { password } = req.body;
    const gmPass = process.env.GM_PASSWORD;

    if (!gmPass) {
      return res.status(500).json({ error: 'GM password not set' });
    }
    if (password !== gmPass) {
      logger?.warn('GM login failed: bad password');
      return res.status(401).json({ error: 'Invalid password' });
    }

    let masterUser = null;

    try {
      masterUser = userRepository.findByUsername('GM');
    } catch (err) {
      logger?.warn({ err }, 'Failed to lookup GM user');
    }

    if (!masterUser) {
      try {
        const passwordHash = bcrypt.hashSync(gmPass, 10);
        masterUser = userRepository.insertUser({
          username: 'GM',
          passwordHash,
          role: USER_ROLES.MASTER,
        });
      } catch (err) {
        logger?.error({ err }, 'Failed to ensure GM user exists');
        return res.status(500).json({ error: 'Failed to initialise GM identity' });
      }
    }

    const token = jwt.signUser({
      id: masterUser?.id ?? 'GM',
      username: masterUser?.username ?? 'GM',
      role: USER_ROLES.MASTER,
    });

    return res.json({
      token,
      role: 'MASTER',
    });
  });

  return router;
}
