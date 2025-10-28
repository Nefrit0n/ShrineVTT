function extractTokenFromHandshake(socket) {
  const authToken = socket.handshake?.auth?.token;
  if (typeof authToken === 'string' && authToken) {
    return authToken;
  }

  const queryToken = socket.handshake?.query?.token;
  if (Array.isArray(queryToken)) {
    if (typeof queryToken[0] === 'string' && queryToken[0]) {
      return queryToken[0];
    }
  } else if (typeof queryToken === 'string' && queryToken) {
    return queryToken;
  }

  const headerToken = socket.handshake?.headers?.authorization || socket.handshake?.headers?.Authorization;
  if (typeof headerToken === 'string') {
    const match = headerToken.match(/^Bearer\s+(.+)$/i);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

export default function registerWsMiddleware(namespace, { logger, jwt }) {
  namespace.use((socket, next) => {
    const token = extractTokenFromHandshake(socket);

    const asGuest = () => {
      socket.data.role = 'GUEST';
      socket.data.username = 'Guest';
      socket.data.sessionId = null;
    };

    if (token) {
      try {
        const user = jwt.verifyToken(token);
        socket.data.role = user.role;
        socket.data.username = user.username;
        socket.data.sessionId = user.sessionId ?? null;
        socket.data.userId = user.id;
        logger?.info({ role: user.role, username: user.username, sessionId: socket.data.sessionId }, 'WS token auth');
      } catch (e) {
        logger?.warn({ err: e }, 'Invalid JWT in WS handshake, falling back to guest');
        asGuest();
      }
    } else {
      asGuest();
    }

    next();
  });
}
