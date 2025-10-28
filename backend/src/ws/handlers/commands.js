import log from '../../log.js';

export default function registerCommandHandlers(namespace, { logger = log }) {
  namespace.on('connection', (socket) => {
    socket.on('message', (envelope) => {
      if (!envelope || typeof envelope !== 'object') {
        return;
      }

      const { type, payload } = envelope;

      if (type?.startsWith('cmd.')) {
        logger.info(
          {
            type,
            from: socket.data.username,
            role: socket.data.role,
            sessionId: socket.data.sessionId,
            payload,
          },
          'Command received',
        );

        // Ответ-заглушка для фронта, чтобы было видно
        socket.emit('message', {
          type: 'cmd.ack',
          ts: Date.now(),
          payload: {
            acknowledged: type,
            from: socket.data.username,
          },
        });
      }
    });
  });
}
