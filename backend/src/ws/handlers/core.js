import log from '../../log.js';

const SERVER_NAME = 'shrinevtt';

export default function registerCoreHandlers(namespace, { logger = log }) {
  namespace.on('connection', (socket) => {
    logger.info(
      { username: socket.data.username, role: socket.data.role, sid: socket.data.sessionId },
      'Client connected via WS',
    );

    socket.on('message', (envelope) => {
      if (!envelope || typeof envelope !== 'object') {
        return;
      }

      const { type, rid } = envelope;

      switch (type) {
        case 'core.handshake:in': {
          const outEnvelope = {
            type: 'core.handshake:out',
            rid,
            ts: Date.now(),
            payload: {
              server: SERVER_NAME,
              role: socket.data.role,
              sessionId: socket.data.sessionId,
            },
          };

          socket.emit('message', outEnvelope);
          logger.info(
            { role: socket.data.role, sessionId: socket.data.sessionId },
            'Handshake completed',
          );
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
