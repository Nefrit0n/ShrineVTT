import { WS_ENVELOPE_EVENT } from '../contracts.js';
import log from '../../log.js';
import { executeCommand, getCommandHandler } from '../../application/commands/index.js';
import createIdempotencyCache from '../idempotency.js';

const idempotencyCache = createIdempotencyCache();

function getUserKey(socket) {
  if (socket.data?.userId) {
    return `user:${socket.data.userId}`;
  }

  return `session:${socket.id}`;
}

function buildResponseEnvelope(commandType, rid, result) {
  const responseType =
    result && typeof result === 'object' && result.type
      ? result.type
      : `${commandType}.result`;

  const payload =
    result && typeof result === 'object' && 'payload' in result
      ? result.payload
      : result;

  const envelope = {
    type: responseType,
    rid,
    ts: Date.now(),
  };

  if (payload !== undefined) {
    envelope.payload = payload;
  }

  return envelope;
}

export default function registerCommandHandlers(namespace, { logger = log } = {}) {
  namespace.on('connection', (socket) => {
    socket.on(WS_ENVELOPE_EVENT, async (envelope) => {
      if (!envelope || typeof envelope !== 'object') {
        return;
      }

      const { type, rid } = envelope;
      if (!type) {
        return;
      }

      const handler = getCommandHandler(type);
      if (!handler) {
        return;
      }

      if (!rid) {
        logger.warn({ type, socketId: socket.id }, 'WS command missing rid');
        return;
      }

      const userKey = getUserKey(socket);
      const cachedResponse = idempotencyCache.get(userKey, rid);
      if (cachedResponse) {
        logger.debug(
          { type, socketId: socket.id, rid },
          'WS command replayed from idempotency cache',
        );
        socket.emit(WS_ENVELOPE_EVENT, cachedResponse);
        return;
      }

      try {
        const result = await executeCommand(type, {
          payload: envelope.payload,
          envelope,
          socket,
          context: {
            user: socket.data?.user ?? null,
            userId: socket.data?.userId ?? null,
            role: socket.data?.role ?? null,
          },
        });

        const response = buildResponseEnvelope(type, rid, result);
        idempotencyCache.set(userKey, rid, response);
        socket.emit(WS_ENVELOPE_EVENT, response);
      } catch (err) {
        logger.error(
          { err, type, socketId: socket.id, rid },
          'WS command execution failed',
        );

        const errorResponse = {
          type: `${type}.error`,
          rid,
          ts: Date.now(),
          payload: {
            message: 'Command failed',
          },
        };
        idempotencyCache.set(userKey, rid, errorResponse);
        socket.emit(WS_ENVELOPE_EVENT, errorResponse);
      }
    });
  });
}
