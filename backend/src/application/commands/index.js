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

    const isMaster = actorRole === 'MASTER';
    if (!isMaster) {
      const ownerId = token.ownerUserId ?? null;
      if (!actorUserId || ownerId !== actorUserId) {
        throw new DomainError('FORBIDDEN', { code: 'FORBIDDEN' });
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

    const rawXCell = parseCell(payload.xCell, 'xCell');
    const rawYCell = parseCell(payload.yCell, 'yCell');

    const gridSize = Number.isFinite(scene.gridSize) ? scene.gridSize : Number.parseFloat(scene.gridSize);
    const safeGridSize = Number.isFinite(gridSize) && gridSize > 0 ? gridSize : 0;
    const widthPx = Number.isFinite(scene.widthPx) ? scene.widthPx : Number.parseFloat(scene.widthPx);
    const heightPx = Number.isFinite(scene.heightPx) ? scene.heightPx : Number.parseFloat(scene.heightPx);
    const cols = safeGridSize > 0 && Number.isFinite(widthPx) ? Math.max(0, Math.floor(widthPx / safeGridSize)) : 0;
    const rows = safeGridSize > 0 && Number.isFinite(heightPx) ? Math.max(0, Math.floor(heightPx / safeGridSize)) : 0;

    const clampToBounds = (value, max) => {
      if (!Number.isInteger(value)) {
        return 0;
      }
      const nonNegative = value < 0 ? 0 : value;
      if (max <= 0) {
        return nonNegative;
      }
      return Math.min(nonNegative, Math.max(0, max - 1));
    };

    const xCell = clampToBounds(rawXCell, cols);
    const yCell = clampToBounds(rawYCell, rows);

    let expectedVersion = token.version;
    if (payload.version !== undefined) {
      const parsedVersion = Number.parseInt(payload.version, 10);
      if (!Number.isInteger(parsedVersion) || parsedVersion < 0) {
        throw new DomainError('version must be a non-negative integer');
      }

      if (parsedVersion !== token.version) {
        throw new StaleUpdateError('STALE_UPDATE');
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

export function registerTokenAssignOwnerCommand({
  sceneRepository,
  tokenRepository,
  sessionRepository,
  logger,
}) {
  if (!sceneRepository || typeof sceneRepository.findById !== 'function') {
    throw new Error('sceneRepository dependency is required to register token.assignOwner command');
  }

  if (
    !tokenRepository ||
    typeof tokenRepository.findById !== 'function' ||
    typeof tokenRepository.update !== 'function'
  ) {
    throw new Error('tokenRepository dependency is required to register token.assignOwner command');
  }

  if (!sessionRepository || typeof sessionRepository.listMembers !== 'function') {
    throw new Error('sessionRepository dependency is required to register token.assignOwner command');
  }

  const log = logger?.child ? logger.child({ command: 'token.assignOwner' }) : logger;

  register('token.assignOwner', async ({ sessionId, actorRole, payload }) => {
    if (!sessionId) {
      throw new Error('Session context is required to assign token owner');
    }

    if (actorRole !== 'MASTER') {
      throw new DomainError('Недостаточно прав для изменения владельца жетона.', {
        code: 'FORBIDDEN',
      });
    }

    if (!payload || typeof payload !== 'object') {
      throw new DomainError('Invalid token.assignOwner payload');
    }

    const tokenId = typeof payload.tokenId === 'string' ? payload.tokenId.trim() : '';
    if (!tokenId) {
      throw new DomainError('tokenId is required to assign token owner');
    }

    const ownerRaw =
      payload.ownerUserId === undefined || payload.ownerUserId === null
        ? ''
        : String(payload.ownerUserId).trim();
    const ownerUserId = ownerRaw.length ? ownerRaw : null;

    const token = tokenRepository.findById({ sessionId, tokenId });
    if (!token) {
      throw new DomainError('Token not found for owner assignment');
    }

    if ((token.ownerUserId ?? null) === ownerUserId) {
      return { token: token.toObject() };
    }

    const scene = sceneRepository.findById({ sessionId, sceneId: token.sceneId });
    if (!scene) {
      throw new DomainError('Scene not found for token owner assignment');
    }

    if (ownerUserId) {
      const members = sessionRepository.listMembers(sessionId);
      const ownerCandidate = members.find((member) => member.userId === ownerUserId);
      if (!ownerCandidate) {
        throw new DomainError('Участник не найден в этой сессии', { code: 'MEMBER_NOT_FOUND' });
      }
    }

    try {
      const updated = tokenRepository.update({
        scene,
        tokenId: token.id,
        expectedVersion: token.version,
        patch: { ownerUserId },
      });

      log?.info?.(
        {
          tokenId: updated.id,
          sessionId,
          ownerUserId: updated.ownerUserId ?? null,
        },
        'Token owner updated',
      );

      return { token: updated.toObject() };
    } catch (err) {
      if (err instanceof StaleUpdateError) {
        throw new DomainError('Состояние жетона устарело. Обновите сцену и повторите попытку.', {
          code: 'STALE_TOKEN',
        });
      }
      throw err;
    }
  });
}

export default {
  register,
  getCommandHandler,
  executeCommand,
  registerTokenCreateCommand,
  registerTokenMoveCommand,
  registerTokenAssignOwnerCommand,
};
