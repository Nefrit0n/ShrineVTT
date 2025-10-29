import { DomainError } from '../../errors.js';
import { StaleUpdateError } from '../../domain/errors.js';

const COMMAND_HANDLERS = new Map();

function register(type, handler) {
  if (!type || typeof type !== 'string') {
    throw new TypeError('Command type must be a non-empty string');
  }

  if (typeof handler !== 'function') {
    throw new TypeError(`Command handler for "${type}" must be a function`);
  }

  COMMAND_HANDLERS.set(type, handler);
}

export function getCommandHandler(type) {
  return COMMAND_HANDLERS.get(type) ?? null;
}

export async function executeCommand(type, input) {
  const handler = getCommandHandler(type);
  if (!handler) {
    throw new Error(`Unknown command: ${type}`);
  }

  return handler(input);
}

register('demo.echo', async ({ payload }) => ({
  type: 'demo.echo.result',
  payload,
}));

export function registerTokenCreateCommand({ sceneRepository, tokenRepository, logger }) {
  if (!sceneRepository || typeof sceneRepository.findById !== 'function') {
    throw new Error('sceneRepository dependency is required to register token.create command');
  }

  if (!tokenRepository || typeof tokenRepository.create !== 'function') {
    throw new Error('tokenRepository dependency is required to register token.create command');
  }

  const log = logger?.child ? logger.child({ command: 'token.create' }) : logger;

  register('token.create', async ({ sessionId, actorRole, payload }) => {
    if (!sessionId) {
      throw new Error('Session context is required to create a token');
    }

    if (actorRole !== 'MASTER') {
      throw new Error('Only the Game Master can create tokens');
    }

    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid token.create payload');
    }

    const sceneId = typeof payload.sceneId === 'string' ? payload.sceneId.trim() : '';
    if (!sceneId) {
      throw new Error('sceneId is required to create a token');
    }

    const scene = sceneRepository.findById({ sessionId, sceneId });
    if (!scene) {
      throw new Error('Scene not found for token creation');
    }

    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    if (!name) {
      throw new Error('name is required to create a token');
    }

    const parseCell = (value, field) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(`${field} must be a non-negative integer`);
      }
      return parsed;
    };

    const xCell = parseCell(payload.xCell, 'xCell');
    const yCell = parseCell(payload.yCell, 'yCell');

    const spriteRaw = typeof payload.sprite === 'string' ? payload.sprite.trim() : '';
    const sprite = spriteRaw.length ? spriteRaw : null;
    const ownerRaw = payload.ownerUserId != null ? String(payload.ownerUserId).trim() : '';
    const ownerUserId = ownerRaw.length ? ownerRaw : null;

    const token = tokenRepository.create({
      scene,
      name,
      xCell,
      yCell,
      sprite,
      ownerUserId,
    });

    log?.info?.(
      {
        tokenId: token.id,
        sceneId: token.sceneId,
        xCell: token.xCell,
        yCell: token.yCell,
      },
      'Token created',
    );

    return { token: token.toObject() };
  });
}

export function registerTokenMoveCommand({ sceneRepository, tokenRepository, logger }) {
  if (!sceneRepository || typeof sceneRepository.findById !== 'function') {
    throw new Error('sceneRepository dependency is required to register token.move command');
  }

  if (!tokenRepository || typeof tokenRepository.findById !== 'function' || typeof tokenRepository.update !== 'function') {
    throw new Error('tokenRepository dependency is required to register token.move command');
  }

  const log = logger?.child ? logger.child({ command: 'token.move' }) : logger;

  register('token.move', async ({ sessionId, actorRole, actorUserId, payload }) => {
    if (!sessionId) {
      throw new Error('Session context is required to move a token');
    }

    if (!payload || typeof payload !== 'object') {
      throw new DomainError('Invalid token.move payload');
    }

    const tokenId = typeof payload.tokenId === 'string' ? payload.tokenId.trim() : '';
    if (!tokenId) {
      throw new DomainError('tokenId is required to move a token');
    }

    const token = tokenRepository.findById({ sessionId, tokenId });
    if (!token) {
      throw new DomainError('Token not found for movement');
    }

    if (actorRole !== 'MASTER') {
      const ownerId = token.ownerUserId ?? null;
      if (!actorUserId || ownerId !== actorUserId) {
        throw new DomainError('You do not have permission to move this token');
      }
    }

    const scene = sceneRepository.findById({ sessionId, sceneId: token.sceneId });
    if (!scene) {
      throw new DomainError('Scene not found for token movement');
    }

    const parseCell = (value, field) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed)) {
        throw new DomainError(`${field} must be an integer`);
      }
      if (parsed < 0) {
        throw new DomainError(`${field} must be a non-negative integer`);
      }
      return parsed;
    };

    const xCell = parseCell(payload.xCell, 'xCell');
    const yCell = parseCell(payload.yCell, 'yCell');

    let expectedVersion = token.version;
    if (payload.version !== undefined) {
      const parsedVersion = Number.parseInt(payload.version, 10);
      if (!Number.isInteger(parsedVersion) || parsedVersion < 0) {
        throw new DomainError('version must be a non-negative integer');
      }

      if (parsedVersion !== token.version) {
        throw new StaleUpdateError('Token has been modified since it was read');
      }

      expectedVersion = parsedVersion;
    }

    const updatedToken = tokenRepository.update({
      scene,
      tokenId: token.id,
      expectedVersion,
      patch: { xCell, yCell },
    });

    log?.info?.(
      {
        tokenId: updatedToken.id,
        sceneId: updatedToken.sceneId,
        xCell: updatedToken.xCell,
        yCell: updatedToken.yCell,
        version: updatedToken.version,
      },
      'Token moved',
    );

    return {
      tokenId: updatedToken.id,
      sceneId: updatedToken.sceneId,
      xCell: updatedToken.xCell,
      yCell: updatedToken.yCell,
      version: updatedToken.version,
      updatedAt: updatedToken.updatedAt,
    };
  });
}

export default {
  register,
  getCommandHandler,
  executeCommand,
  registerTokenCreateCommand,
  registerTokenMoveCommand,
};
