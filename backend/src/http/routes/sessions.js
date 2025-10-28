import { Router } from 'express';
import { USER_ROLES } from '../../../../shared/auth.js';
import { HttpError } from '../../errors.js';

function extractBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (typeof header !== 'string') {
    return null;
  }

  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export default function createSessionsRouter({ sessionRepository, jwt, logger }) {
  if (!sessionRepository) {
    throw new Error('sessionRepository dependency is required');
  }
  if (!jwt) {
    throw new Error('jwt dependency is required');
  }

  const router = Router();

  router.post('/', (req, res, next) => {
    try {
      const token = extractBearerToken(req);
      if (!token) {
        throw new HttpError(401, 'Authorization token required', { code: 'AUTH_REQUIRED' });
      }

      let authUser;
      try {
        authUser = jwt.verifyToken(token);
      } catch (err) {
        throw new HttpError(401, 'Invalid token', { code: 'INVALID_TOKEN' });
      }

      if (authUser.role !== USER_ROLES.MASTER) {
        throw new HttpError(403, 'Forbidden', { code: 'FORBIDDEN' });
      }

      const session = sessionRepository.createSession({
        masterUserId: authUser.id,
        masterUsername: authUser.username,
      });

      logger?.info({ sessionId: session.id, master: authUser.username }, 'Session created');

      res.status(201).json({ sessionId: session.id, code: session.code });
    } catch (error) {
      next(error);
    }
  });

  router.post('/join', (req, res, next) => {
    try {
      const { code, username } = req.body ?? {};

      if (typeof code !== 'string' || !code.trim()) {
        throw new HttpError(400, 'Session code is required', { code: 'SESSION_CODE_REQUIRED' });
      }
      if (typeof username !== 'string' || !username.trim()) {
        throw new HttpError(400, 'Username is required', { code: 'USERNAME_REQUIRED' });
      }

      const normalizedCode = code.trim().toUpperCase();
      if (normalizedCode.length !== 6) {
        throw new HttpError(400, 'Session code must be 6 characters', { code: 'INVALID_SESSION_CODE' });
      }

      const cleanUsername = username.trim();

      const session = sessionRepository.findByCode(normalizedCode);
      if (!session) {
        throw new HttpError(404, 'Session not found', { code: 'SESSION_NOT_FOUND' });
      }

      const member = sessionRepository.addMember({
        sessionId: session.id,
        username: cleanUsername,
        role: USER_ROLES.PLAYER,
      });

      const token = jwt.signUser({
        id: member.userId,
        username: member.username,
        role: USER_ROLES.PLAYER,
        sessionId: session.id,
      });

      logger?.info({ sessionId: session.id, username: member.username }, 'Player joined session');

      res.json({
        token,
        user: { id: member.userId, username: member.username, role: USER_ROLES.PLAYER },
        sessionId: session.id,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
