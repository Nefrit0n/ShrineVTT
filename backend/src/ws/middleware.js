export default function registerWsMiddleware(namespace, { logger, jwt }) {
  namespace.use((socket, next) => {
    // Two sources: Socket.IO auth & first handshake payload
    const { token, nickname, sessionId } = socket.handshake.auth || {};

    const asPlayer = () => {
      socket.data.role = 'PLAYER';
      socket.data.username = nickname ?? 'Adventurer';
      socket.data.sessionId = sessionId || null;
    };

    if (token) {
      try {
        const user = jwt.verifyToken(token);
        socket.data.role = user.role;
        socket.data.username = user.username;
        socket.data.sessionId = sessionId || null;
        logger.info({ role: user.role, user: user.username }, 'WS token auth');
      } catch (e) {
        logger.warn('Invalid JWT in handshake, falling back to PLAYER');
        asPlayer();
      }
    } else {
      asPlayer();
    }

    next();
  });
}
