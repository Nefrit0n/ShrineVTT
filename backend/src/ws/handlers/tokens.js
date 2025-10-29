import log from '../../log.js';
import db from '../../infra/db/sqlite.js';
import SceneRepository from '../../infra/repositories/SceneRepository.js';
import TokenRepository from '../../infra/repositories/TokenRepository.js';
import {
  executeCommand,
  registerTokenCreateCommand,
  registerTokenMoveCommand,
} from '../../application/commands/index.js';
import { DomainError } from '../../errors.js';

const sceneRepository = new SceneRepository(db);
const tokenRepository = new TokenRepository(db);

let commandsRegistered = false;

function ensureTokenCommandsRegistered(logger) {
  if (commandsRegistered) {
    return;
  }

  registerTokenCreateCommand({ sceneRepository, tokenRepository, logger });
  registerTokenMoveCommand({ sceneRepository, tokenRepository, logger });
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
  },
  'token.move:in': {
    command: 'token.move',
    successType: 'token.move:out',
    errorType: 'token.move:error',
    fallbackError: 'Не удалось переместить жетон.',
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
              tokenId: result?.tokenId ?? payload?.tokenId ?? null,
              sceneId: result?.sceneId ?? null,
              xCell: result?.xCell ?? payload?.xCell ?? null,
              yCell: result?.yCell ?? payload?.yCell ?? null,
              sessionId,
              actorRole,
              username: socket.data?.username ?? null,
            },
            'Token moved via WS',
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
            username: socket.data?.username ?? null,
          },
          commandConfig.command === 'token.move' ? 'Failed to move token' : 'Failed to create token',
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
