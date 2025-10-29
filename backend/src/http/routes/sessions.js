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

export default function createSessionsRouter({ sessionRepository, playerStateRepository, jwt, logger }) {
  if (!sessionRepository) {
    throw new Error('sessionRepository dependency is required');
  }
  if (!playerStateRepository) {
    throw new Error('playerStateRepository dependency is required');
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

    playerStateRepository.ensurePlayerState({ sessionId: session.id, userId, username });

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
