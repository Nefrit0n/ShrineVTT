import { Router } from 'express';

function extractBearerToken(req) {
  const header = req.get('authorization') ?? req.get('Authorization');
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.*)$/i);
  if (!match) return null;
  return match[1].trim();
}

function serializeState(state) {
  if (!state) return null;
  return {
    sessionId: state.sessionId,
    userId: state.userId,
    username: state.username,
    tools: state.tools,
    inventory: state.inventory,
    notes: state.notes ?? '',
    actorId: state.actorId ?? null,
  };
}

export default function createPlayerStateRouter({ playerStateRepository, jwt, logger }) {
  if (!playerStateRepository) {
    throw new Error('playerStateRepository dependency is required');
  }
  if (!jwt) {
    throw new Error('jwt dependency is required');
  }

  const router = Router({ mergeParams: true });

  router.use((req, res, next) => {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let user;
    try {
      user = jwt.verifyToken(token);
    } catch (err) {
      logger?.warn({ err }, 'Failed to verify token for player state request');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { sessionId } = req.params;
    if (!sessionId || user.sessionId !== sessionId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    req.user = user;
    return next();
  });

  router.get('/', (req, res) => {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const state = playerStateRepository.ensurePlayerState({
      sessionId,
      userId,
      username: req.user.username,
    });
    if (!state) {
      return res.status(404).json({ error: 'Player state not found' });
    }

    return res.json(serializeState(state));
  });

  router.put('/', (req, res) => {
    const { sessionId } = req.params;
    const userId = req.user.id;
    const { notes } = req.body ?? {};

    if (notes !== undefined && typeof notes !== 'string') {
      return res.status(400).json({ error: 'Notes must be a string' });
    }

    playerStateRepository.ensurePlayerState({ sessionId, userId, username: req.user.username });

    const updated = playerStateRepository.updateNotes({ sessionId, userId, notes: notes ?? '' });
    if (!updated) {
      return res.status(404).json({ error: 'Player state not found' });
    }

    return res.json(serializeState(updated));
  });

  return router;
}

