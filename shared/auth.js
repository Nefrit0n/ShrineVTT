/**
 * @typedef {'MASTER' | 'PLAYER'} UserRole
 */

/**
 * @typedef {'GUEST' | UserRole} SessionRole
 */

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} username
 * @property {UserRole} role
 * @property {string} createdAt
 */

/**
 * @typedef {Object} SessionUser
 * @property {string} id
 * @property {string} username
 * @property {SessionRole} role
 * @property {string | null} [sessionId]
 */

export const USER_ROLES = Object.freeze({
  MASTER: 'MASTER',
  PLAYER: 'PLAYER',
});

export const GUEST_ROLE = 'GUEST';

export const SESSION_ROLES = Object.freeze({
  MASTER: USER_ROLES.MASTER,
  PLAYER: USER_ROLES.PLAYER,
  GUEST: GUEST_ROLE,
});
