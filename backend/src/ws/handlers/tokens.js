import log from '../../log.js';
import db from '../../infra/db/sqlite.js';
import SceneRepository from '../../infra/repositories/SceneRepository.js';
import TokenRepository from '../../infra/repositories/TokenRepository.js';
import SessionRepository from '../../infra/repositories/SessionRepository.js';
import {
  executeCommand,
  registerTokenCreateCommand,
  registerTokenMoveCommand,
  registerTokenAssignOwnerCommand,
} from '../../application/commands/index.js';
import { DomainError } from '../../errors.js';

const sceneRepository = new SceneRepository(db);
const tokenRepository = new TokenRepository(db);
const sessionRepository = new SessionRepository(db);

let commandsRegistered = false;

function ensureTokenCommandsRegistered(logger) {
  if (commandsRegistered) {
    return;
  }

  registerTokenCreateCommand({ sceneRepository, tokenRepository, logger });
  registerTokenMoveCommand({ sceneRepository, tokenRepository, logger });
  registerTokenAssignOwnerCommand({
    sceneRepository,
    tokenRepository,
    sessionRepository,
    logger,
  });
  commandsRegistered = true;
}

function normalizeErrorMessage(err, fallback = 'Не удалось выполнить действие.') {
  if (!err) {
    return fallback;
  }

  if (err instanceof DomainError) {
    return err.message || fallback;
  }

  if (typeof err.message === 'string' && err.message.trim()) {
    return err.message.trim();
  }

  return fallback;
}

const TOKEN_COMMAND_MAP = {
  'token.create:in': {
    command: 'token.create',
    successType: 'token.create:out',
    errorType: 'token.create:error',
    fallbackError: 'Не удалось создать жетон.',
    logErrorMessage: 'Failed to create token',
  },
  'token.move:in': {
    command: 'token.move',
    successType: 'token.move:out',
    errorType: 'token.move:error',
    fallbackError: 'Не удалось переместить жетон.',
    logErrorMessage: 'Failed to move token',
  },
  'token.assignOwner:in': {
    command: 'token.assignOwner',
    successType: 'token.assignOwner:out',
    errorType: 'token.assignOwner:error',
    fallbackError: 'Не удалось назначить владельца жетона.',
    logErrorMessage: 'Failed to assign token owner',
  },
};

export default function registerTokenHandlers(namespace, { logger = log } = {}) {
  ensureTokenCommandsRegistered(logger);

  namespace.on('connection', (socket) => {
    socket.on('message', async (envelope = {}) => {
      const { type, rid, payload } = envelope;
      const commandConfig = TOKEN_COMMAND_MAP[type];
      if (!commandConfig) {
        return;
      }

      const sessionId = socket.data?.sessionId ?? null;
      const actorRole = socket.data?.role ?? 'PLAYER';
      const actorUserId = socket.data?.userId ?? null;

      if (!sessionId) {
        socket.emit('message', {
          type: commandConfig.errorType,
          rid,
          ts: Date.now(),
          payload: { error: 'Подключитесь к сессии, чтобы управлять жетонами.' },
        });
        return;
      }

      try {
        const result = await executeCommand(commandConfig.command, {
          sessionId,
          actorRole,
          actorUserId,
          payload,
        });

        const outEnvelope = {
          type: commandConfig.successType,
          rid,
          ts: Date.now(),
          payload: result,
        };

        namespace.to(sessionId).emit('message', outEnvelope);

        if (commandConfig.command === 'token.create') {
          logger.info(
            {
              tokenId: result?.token?.id ?? null,
              sceneId: result?.token?.sceneId ?? payload?.sceneId ?? null,
              sessionId,
              actorRole,
              username: socket.data?.username ?? null,
            },
            'Token created via WS',
          );
        } else if (commandConfig.command === 'token.move') {
          logger.info(
            {
              rid,
              userId: actorUserId,
              role: actorRole,
              sessionId,
              tokenId: result?.tokenId ?? payload?.tokenId ?? null,
              xCell: result?.xCell ?? payload?.xCell ?? null,
              yCell: result?.yCell ?? payload?.yCell ?? null,
              sceneId: result?.sceneId ?? null,
            },
            'Token moved via WS',
          );
        } else if (commandConfig.command === 'token.assignOwner') {
          const tokenId = result?.token?.id ?? payload?.tokenId ?? null;
          logger.info(
            {
              rid,
              userId: actorUserId,
              role: actorRole,
              sessionId,
              tokenId,
              ownerUserId: result?.token?.ownerUserId ?? payload?.ownerUserId ?? null,
            },
            'Token owner assigned via WS',
          );
        }
      } catch (err) {
        const errorMessage = normalizeErrorMessage(err, commandConfig.fallbackError);

        logger.warn(
          {
            err,
            sessionId,
            sceneId: payload?.sceneId ?? null,
            tokenId: payload?.tokenId ?? null,
            actorRole,
            userId: actorUserId,
            rid,
            username: socket.data?.username ?? null,
          },
          commandConfig.logErrorMessage ?? 'Failed to execute token command',
        );

        socket.emit('message', {
          type: commandConfig.errorType,
          rid,
          ts: Date.now(),
          payload: { error: errorMessage },
        });
      }
    });
  });
}
