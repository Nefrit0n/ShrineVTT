import { GUEST_ROLE } from '../../../shared/auth.js';

function extractBearerToken(authorizationHeader) {
  if (typeof authorizationHeader !== 'string') {
    return null;
  }

  const [scheme, value] = authorizationHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !value) {
    return null;
  }

  return value.trim();
}

function normalizeToken(value) {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  if (typeof value === 'string') {
    return value.trim() || null;
  }

  return null;
}

function extractToken(handshake) {
  const queryToken = normalizeToken(handshake.query?.token);
  if (queryToken) {
    return queryToken;
  }

  const authToken = normalizeToken(handshake.auth?.token);
  if (authToken) {
    return authToken;
  }

  const headerToken =
    extractBearerToken(handshake.headers?.authorization) ??
    normalizeToken(handshake.headers?.['x-access-token']);
  if (headerToken) {
    return headerToken;
  }

  return null;
}

export default function registerWsMiddleware(namespace, { logger, jwt } = {}) {
  namespace.use((socket, next) => {
    const token = extractToken(socket.handshake);

    if (!token || !jwt?.verifyToken) {
      socket.data.role = socket.data.role ?? GUEST_ROLE;
      return next();
    }

    try {
      const user = jwt.verifyToken(token);
      socket.data.user = user;
      socket.data.userId = user.id;
      socket.data.role = user.role ?? GUEST_ROLE;
    } catch (err) {
      logger?.warn({ err }, 'WS authentication failed');
      socket.data.role = GUEST_ROLE;
    }

    return next();
  });
}
