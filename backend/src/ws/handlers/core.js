import log from '../../log.js';

function emitActiveSceneSnapshot(socket, {
  logger,
  sessionService,
  sceneQueries,
  reason,
} = {}) {
  if (!sessionService || !sceneQueries) {
    return;
  }

  const sessionId = socket.data?.sessionId ?? null;
  if (!sessionId) {
    return;
  }

  try {
    const activeSceneId = sessionService.getActiveSceneId(sessionId);
    if (!activeSceneId) {
      socket.emit('message', {
        type: 'scene.snapshot:out',
        ts: Date.now(),
        payload: {
          sessionId,
          sceneId: null,
          snapshot: null,
          reason: reason ?? 'unknown',
        },
      });
      logger?.debug?.({ sessionId, reason }, 'No active scene for session snapshot emit');
      return;
    }

    const snapshot = sceneQueries.getSceneSnapshot({ sessionId, sceneId: activeSceneId });

    if (!snapshot) {
      logger?.warn?.(
        { sessionId, sceneId: activeSceneId },
        'Failed to build active scene snapshot for session',
      );
      socket.emit('message', {
        type: 'scene.snapshot:out',
        ts: Date.now(),
        payload: {
          sessionId,
          sceneId: activeSceneId,
          snapshot: null,
          reason: reason ?? 'unknown',
        },
      });
      return;
    }

    socket.emit('message', {
      type: 'scene.snapshot:out',
      ts: Date.now(),
      payload: {
        sessionId,
        sceneId: activeSceneId,
        snapshot,
        reason: reason ?? 'unknown',
      },
    });

    logger?.info?.(
      { sessionId, sceneId: activeSceneId, reason },
      'Emitted active scene snapshot to socket',
    );
  } catch (err) {
    logger?.error?.(
      { err, sessionId, reason },
      'Failed to emit active scene snapshot',
    );
  }
}

export default function registerCoreHandlers(namespace, {
  logger = log,
  sessionService,
  sceneQueries,
} = {}) {
  namespace.on('connection', (socket) => {
    logger.info(
      { username: socket.data.username, role: socket.data.role, sid: socket.data.sessionId },
      'Client connected via WS',
    );

    emitActiveSceneSnapshot(socket, { logger, sessionService, sceneQueries, reason: 'connection' });

    socket.on('message', (envelope) => {
      if (!envelope || typeof envelope !== 'object') {
        return;
      }

      const { type, rid } = envelope;

      switch (type) {
        case 'core.handshake:in': {
          // Ответ серверного handshake
          const payloadSessionId = envelope?.payload?.sessionId;
          const nextSessionId = typeof payloadSessionId === 'string' && payloadSessionId.length
            ? payloadSessionId
            : null;

          if (nextSessionId && nextSessionId !== socket.data.sessionId) {
            if (socket.data.sessionId) {
              socket.leave(socket.data.sessionId);
            }
            socket.data.sessionId = nextSessionId;
            socket.join(nextSessionId);
            logger.info({ sessionId: nextSessionId, sid: socket.id }, 'Socket session updated via handshake');
          }

          const outEnvelope = {
            type: 'core.handshake:out',
            rid,
            ts: Date.now(),
            payload: {
              role: socket.data.role,
              username: socket.data.username,
              sessionId: socket.data.sessionId,
              userId: socket.data.userId ?? null,
            },
          };

          socket.emit('message', outEnvelope);
          logger.info(
            { role: socket.data.role, sessionId: socket.data.sessionId },
            'Handshake completed'
          );

          emitActiveSceneSnapshot(socket, {
            logger,
            sessionService,
            sceneQueries,
            reason: 'handshake',
          });
          break;
        }

        case 'core.ping': {
          const pongEnvelope = {
            type: 'core.pong',
            rid,
            ts: Date.now(),
            payload: { ts: envelope.ts },
          };
          socket.emit('message', pongEnvelope);
          break;
        }

        default:
          logger.debug({ type }, 'Unhandled WS envelope');
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info({ reason }, 'Client disconnected');
    });
  });
}
