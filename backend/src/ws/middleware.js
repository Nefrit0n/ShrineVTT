function resolveUserIdentity({ userRepository, username }) {
  if (!userRepository || typeof userRepository.findByUsername !== 'function') {
    return { username: typeof username === 'string' ? username : null, userId: null };
  }

  const normalized = typeof username === 'string' ? username.trim() : '';
  if (!normalized) {
    return { username: null, userId: null };
  }

  try {
    const user = userRepository.findByUsername(normalized);
    if (user && user.id) {
      return { username: user.username ?? normalized, userId: String(user.id) };
    }
  } catch (err) {
    // Fall through to default identity if lookup fails.
  }

  return { username: normalized, userId: null };
}

export default function registerWsMiddleware(namespace, { logger, jwt, userRepository }) {
  namespace.use((socket, next) => {
    // Two sources: Socket.IO auth & first handshake payload
    const { token, nickname, sessionId } = socket.handshake.auth || {};

    const asPlayer = () => {
      socket.data.role = 'PLAYER';
      const identity = resolveUserIdentity({ userRepository, username: nickname ?? 'Adventurer' });
      socket.data.username = identity.username ?? 'Adventurer';
      socket.data.userId = identity.userId ?? null;
      socket.data.sessionId = sessionId || null;
    };

    if (token) {
      try {
        const user = jwt.verifyToken(token);
        const identity = resolveUserIdentity({ userRepository, username: user.username });
        socket.data.role = user.role;
        socket.data.username = identity.username ?? user.username;
        socket.data.sessionId = user.sessionId || sessionId || null;
        socket.data.userId = identity.userId ?? user.id ?? null;
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
