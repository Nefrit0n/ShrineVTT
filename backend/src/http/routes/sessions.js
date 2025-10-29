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

export default function createSessionsRouter({
  sessionRepository,
  userRepository,
  playerStateRepository,
  tokenRepository,
  jwt,
  logger,
}) {
  if (!sessionRepository) {
    throw new Error('sessionRepository dependency is required');
  }
  if (!userRepository) {
    throw new Error('userRepository dependency is required');
  }
  if (!playerStateRepository) {
    throw new Error('playerStateRepository dependency is required');
  }
  if (!tokenRepository) {
    throw new Error('tokenRepository dependency is required');
  }
  if (!jwt) {
    throw new Error('jwt dependency is required');
  }

  const router = Router();

  router.get('/', (req, res) => {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let user;
    try {
      user = jwt.verifyToken(token);
    } catch (err) {
      logger?.warn({ err }, 'Failed to verify token for listing sessions');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (user.role !== USER_ROLES.MASTER) {
      return res.status(403).json({ error: 'Only MASTER can list sessions' });
    }

    const sessions = sessionRepository.listByMaster(user.id);
    return res.json({
      sessions: sessions.map((session) => ({
        id: session.id,
        code: session.code,
        createdAt: session.createdAt,
      })),
    });
  });

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

    let userRecord;
    try {
      userRecord = userRepository.ensurePlayerUser(username);
    } catch (err) {
      logger?.error({ err, username }, 'Failed to ensure player user');
      return res.status(500).json({ error: 'Не удалось сохранить игрока' });
    }

    const normalizedUsername = userRecord?.username ?? username;
    const userId = userRecord?.id ?? crypto.randomUUID();
    const role = USER_ROLES.PLAYER;

    const existingMember = sessionRepository.findMemberByUsername(session.id, normalizedUsername);

    if (existingMember?.userId) {
      if (existingMember.userId === userId) {
        sessionRepository.touchMember({ sessionId: session.id, userId });
      } else {
        const previousUserId = existingMember.userId;

        try {
          if (typeof playerStateRepository.reassignUserState === 'function') {
            playerStateRepository.reassignUserState({
              sessionId: session.id,
              fromUserId: previousUserId,
              toUserId: userId,
              username: normalizedUsername,
            });
          }
        } catch (err) {
          logger?.warn(
            { err, sessionId: session.id, fromUserId: previousUserId, toUserId: userId },
            'Failed to reassign player state to persistent user',
          );
        }

        try {
          if (typeof tokenRepository.reassignOwner === 'function') {
            tokenRepository.reassignOwner({
              sessionId: session.id,
              fromUserId: previousUserId,
              toUserId: userId,
            });
          }
        } catch (err) {
          logger?.warn(
            { err, sessionId: session.id, fromUserId: previousUserId, toUserId: userId },
            'Failed to reassign token ownership to persistent user',
          );
        }

        sessionRepository.removeMember({ sessionId: session.id, userId: previousUserId });
      }
    }

    sessionRepository.upsertMember({
      sessionId: session.id,
      userId,
      role,
      username: normalizedUsername,
    });

    playerStateRepository.ensurePlayerState({
      sessionId: session.id,
      userId,
      username: normalizedUsername,
    });

    const token = jwt.signUser({
      id: userId,
      username: normalizedUsername,
      role,
      sessionId: session.id,
    });

    logger?.info({ sessionId: session.id, username: normalizedUsername }, 'Player joined session');

    return res.json({
      token,
      user: { id: userId, username: normalizedUsername, role },
      sessionId: session.id,
    });
  });

  router.get('/:sessionId/members', (req, res) => {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let user;
    try {
      user = jwt.verifyToken(token);
    } catch (err) {
      logger?.warn({ err }, 'Failed to verify token for listing session members');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (user.role !== USER_ROLES.MASTER) {
      return res.status(403).json({ error: 'Only MASTER can list session members' });
    }

    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const session = sessionRepository.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.masterUserId && user.id !== session.masterUserId) {
      return res.status(403).json({ error: 'Only session master can list members' });
    }

    const members = sessionRepository.listMembers(sessionId);
    return res.json({
      members: members.map((member) => ({
        userId: member.userId,
        username: member.username,
        role: member.role,
        joinedAt: member.joinedAt,
      })),
    });
  });

  router.delete('/:sessionId/members/me', (req, res) => {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let user;
    try {
      user = jwt.verifyToken(token);
    } catch (err) {
      logger?.warn({ err }, 'Failed to verify token for leaving session');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (user.role !== USER_ROLES.PLAYER && user.role !== USER_ROLES.MASTER) {
      return res.status(403).json({ error: 'Unsupported role' });
    }

    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const session = sessionRepository.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (user.role === USER_ROLES.PLAYER && user.sessionId && user.sessionId !== sessionId) {
      return res.status(403).json({ error: 'Cannot leave a different session' });
    }

    const removed = sessionRepository.removeMember({ sessionId, userId: user.id });
    logger?.info({ sessionId, userId: user.id, removed }, 'Member requested to leave session');

    return res.status(204).end();
  });

  return router;
}
