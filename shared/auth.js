/**
 * @typedef {'MASTER' | 'PLAYER'} UserRole
 */

/**
 * @typedef {'GUEST' | UserRole} SessionRole
 */

/**
 * @typedef {Object} User
 * @property {number} id
 * @property {string} username
 * @property {UserRole} role
 * @property {string} createdAt
 */

export const USER_ROLES = Object.freeze({
  MASTER: 'MASTER',
  PLAYER: 'PLAYER',
});

export const GUEST_ROLE = 'GUEST';
