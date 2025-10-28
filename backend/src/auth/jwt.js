import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}

const DEFAULT_EXPIRES_IN = '4h';

/**
 * @param {{ id: number; username: string; role: string }} user
 * @param {{ expiresIn?: string | number }} [options]
 * @returns {string}
 */
export function signUser(user, options = {}) {
  const payload = {
    sub: user.id,
    username: user.username,
    role: user.role,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: options.expiresIn ?? DEFAULT_EXPIRES_IN,
  });
}

/**
 * @param {string} token
 * @returns {{ id: number; username: string; role: string }}
 */
export function verifyToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (!decoded || typeof decoded !== 'object') {
    throw new Error('Invalid token payload');
  }

  const id = Number(decoded.sub);
  const { username, role } = decoded;

  if (!Number.isFinite(id) || typeof username !== 'string' || typeof role !== 'string') {
    throw new Error('Invalid token payload');
  }

  return { id, username, role };
}

export default {
  signUser,
  verifyToken,
};

