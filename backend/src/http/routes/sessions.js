import { Router } from 'express';
import crypto from 'node:crypto';

import { USER_ROLES } from '../../../../shared/auth.js';
import { normalizeSessionCode } from '../../infra/repositories/SessionRepository.js';

function extractBearerToken(req) {
  const header = req.get('authorization') ?? req.get('Authorization');
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.*)$/i);
  if (!match) return null;
  return match[1].trim();
}

function sanitizeUsername(raw) {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  return trimmed.slice(0, 32);
}

export default function createSessionsRouter({ sessionRepository, jwt, logger }) {
  if (!sessionRepository) {
    throw new Error('sessionRepository dependency is required');
  }
  if (!jwt) {
    throw new Error('jwt dependency is required');
  }

  const router = Router();

  router.post('/', (req, res) => {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let user;
    try {
      user = jwt.verifyToken(token);
    } catch (err) {
      logger?.warn({ err }, 'Failed to verify token for session creation');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (user.role !== USER_ROLES.MASTER) {
      return res.status(403).json({ error: 'Only MASTER can create sessions' });
    }

    const session = sessionRepository.createSession({ masterUserId: user.id });
    sessionRepository.upsertMember({
      sessionId: session.id,
      userId: user.id,
      role: USER_ROLES.MASTER,
      username: user.username,
    });

    logger?.info({ sessionId: session.id, code: session.code }, 'Session created');

    return res.status(201).json({ sessionId: session.id, code: session.code });
  });

  router.post('/join', (req, res) => {
    const username = sanitizeUsername(req.body?.username ?? '');
    const normalizedCode = normalizeSessionCode(req.body?.code ?? '');

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (!normalizedCode) {
      return res.status(400).json({ error: 'Invalid session code' });
    }

    const session = sessionRepository.findByCode(normalizedCode);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const existingMember = sessionRepository.findMemberByUsername(session.id, username);
    const role = USER_ROLES.PLAYER;
    const userId = existingMember?.userId ?? crypto.randomUUID();

    if (existingMember) {
      sessionRepository.touchMember({ sessionId: session.id, userId });
    }

    sessionRepository.upsertMember({
      sessionId: session.id,
      userId,
      role,
      username,
    });

    const token = jwt.signUser({
      id: userId,
      username,
      role,
      sessionId: session.id,
    });

    logger?.info({ sessionId: session.id, username }, 'Player joined session');

    return res.json({
      token,
      user: { id: userId, username, role },
      sessionId: session.id,
    });
  });

  return router;
}
