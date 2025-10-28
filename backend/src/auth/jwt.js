import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}

const DEFAULT_EXPIRES_IN = '4h';

/**
 * @param {{ id: string | number; username: string; role: string; sessionId?: string | null }} user
 * @param {{ expiresIn?: string | number }} [options]
 * @returns {string}
 */
export function signUser(user, options = {}) {
  const payload = {
    sub: user.id,
    username: user.username,
    role: user.role,
  };

  if (user.sessionId) {
    payload.sessionId = user.sessionId;
  }

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: options.expiresIn ?? DEFAULT_EXPIRES_IN,
  });
}

/**
 * @param {string} token
 * @returns {{ id: string; username: string; role: string; sessionId: string | null }}
 */
export function verifyToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (!decoded || typeof decoded !== 'object') {
    throw new Error('Invalid token payload');
  }

  const { sub, username, role, sessionId } = decoded;

  if ((typeof sub !== 'string' && typeof sub !== 'number') || typeof username !== 'string' || typeof role !== 'string') {
    throw new Error('Invalid token payload');
  }

  const id = typeof sub === 'string' ? sub : String(sub);
  const normalizedSessionId = typeof sessionId === 'string' ? sessionId : null;

  return { id, username, role, sessionId: normalizedSessionId };
}

export default {
  signUser,
  verifyToken,
};

