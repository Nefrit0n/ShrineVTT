import { Router } from 'express';
import { USER_ROLES } from '../../../../shared/auth.js';
import { DomainError } from '../../errors.js';

function extractBearerToken(req) {
  const header = req.get('authorization') ?? req.get('Authorization');
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.*)$/i);
  if (!match) return null;
  return match[1].trim();
}

function parseIntOrUndefined(value) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function normalizeErrorPayload(err) {
  if (!err) return 'Unexpected error';
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    if (typeof err.error === 'string') return err.error;
    if (err.error && typeof err.error.message === 'string') {
      return err.error.message;
    }
    if (typeof err.message === 'string') return err.message;
  }
  return 'Unexpected error';
}

export default function createScenesRouter({
  sceneRepository,
  sessionRepository,
  sessionService,
  sceneQueries,
  jwt,
  logger,
}) {
  if (!sceneRepository) throw new Error('sceneRepository dependency is required');
  if (!sessionRepository) throw new Error('sessionRepository dependency is required');
  if (!sessionService) throw new Error('sessionService dependency is required');
  if (!sceneQueries) throw new Error('sceneQueries dependency is required');
  if (!jwt) throw new Error('jwt dependency is required');

  const router = Router();

  router.post('/sessions/:sessionId/scenes', (req, res) => {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let user;
    try {
      user = jwt.verifyToken(token);
    } catch (err) {
      logger?.warn({ err }, 'Failed to verify token for scene creation');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (user.role !== USER_ROLES.MASTER) {
      return res.status(403).json({ error: 'Only MASTER can create scenes' });
    }

    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const session = sessionRepository.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.masterUserId && session.masterUserId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const {
      name = '',
      gridSize,
      widthPx,
      heightPx,
      mapImage = null,
    } = req.body ?? {};

    const payload = {
      sessionId,
      name,
      gridSize: parseIntOrUndefined(gridSize),
      widthPx: parseIntOrUndefined(widthPx),
      heightPx: parseIntOrUndefined(heightPx),
      mapImage,
    };

    try {
      const scene = sceneRepository.create(payload);
      logger?.info({ sessionId, sceneId: scene.id }, 'Scene created');
      return res.status(201).json({ scene: scene.toObject() });
    } catch (err) {
      if (err instanceof DomainError) {
        return res.status(400).json({ error: err.message });
      }

      logger?.error({ err, sessionId }, 'Failed to create scene');
      return res.status(500).json({ error: 'Failed to create scene' });
    }
  });

  router.get('/sessions/:sessionId/active-scene', (req, res) => {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let user;
    try {
      user = jwt.verifyToken(token);
    } catch (err) {
      logger?.warn({ err }, 'Failed to verify token for active scene fetch');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const session = sessionRepository.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (user.role === USER_ROLES.MASTER) {
      if (session.masterUserId && session.masterUserId !== user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    } else if (user.role === USER_ROLES.PLAYER) {
      if (!user.sessionId || user.sessionId !== sessionId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    } else {
      return res.status(403).json({ error: 'Unsupported role' });
    }

    const activeSceneId = sessionService.getActiveSceneId(sessionId);
    return res.json({ sessionId, activeSceneId: activeSceneId ?? null });
  });

  router.get('/scenes/:sceneId/snapshot', (req, res) => {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let user;
    try {
      user = jwt.verifyToken(token);
    } catch (err) {
      logger?.warn({ err }, 'Failed to verify token for scene snapshot');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { sceneId } = req.params;
    if (!sceneId) {
      return res.status(400).json({ error: 'sceneId is required' });
    }

    let sessionId = req.query?.sessionId;
    if (typeof sessionId === 'string' && !sessionId.trim()) {
      sessionId = undefined;
    }

    if (user.role === USER_ROLES.PLAYER) {
      if (!user.sessionId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      sessionId = user.sessionId;
    } else if (user.role === USER_ROLES.MASTER) {
      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId query parameter is required' });
      }
      const session = sessionRepository.findById(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (session.masterUserId && session.masterUserId !== user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    } else {
      return res.status(403).json({ error: 'Unsupported role' });
    }

    const snapshot = sceneQueries.getSceneSnapshot({ sessionId, sceneId });
    if (!snapshot) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    return res.json(snapshot);
  });

  router.post('/sessions/:sessionId/active-scene', (req, res) => {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let user;
    try {
      user = jwt.verifyToken(token);
    } catch (err) {
      logger?.warn({ err }, 'Failed to verify token for active scene update');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (user.role !== USER_ROLES.MASTER) {
      return res.status(403).json({ error: 'Only MASTER can set active scene' });
    }

    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const session = sessionRepository.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.masterUserId && session.masterUserId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let { sceneId = null } = req.body ?? {};
    if (sceneId === undefined || sceneId === null || sceneId === '') {
      sceneId = null;
    } else {
      sceneId = String(sceneId);
      const scene = sceneRepository.findById({ sessionId, sceneId });
      if (!scene) {
        return res.status(404).json({ error: 'Scene not found' });
      }
    }

    try {
      const state = sessionService.setActiveScene({ sessionId, sceneId });
      logger?.info({ sessionId, sceneId: state.activeSceneId }, 'Active scene updated');
      return res.json(state);
    } catch (err) {
      logger?.error({ err, sessionId }, 'Failed to set active scene');
      return res.status(500).json({ error: normalizeErrorPayload(err) });
    }
  });

  return router;
}
