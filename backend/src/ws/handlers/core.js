import {
  CORE_HANDSHAKE_IN,
  CORE_HANDSHAKE_OUT,
  CORE_PING,
  CORE_PONG,
  WS_ENVELOPE_EVENT,
} from '../contracts.js';
import log from '../../log.js';

function emitEnvelope(target, type, payload, { rid, ts } = {}) {
  const envelope = {
    type,
    ts: ts ?? Date.now(),
    payload,
  };

  if (rid !== undefined) {
    envelope.rid = rid;
  }

  target.emit(WS_ENVELOPE_EVENT, envelope);
  return envelope;
}

function handleHandshake(socket, envelope, logger) {
  const { rid, payload } = envelope;
  const client = payload?.client ?? 'unknown';
  const version = payload?.version ?? 'unknown';

  socket.data.client = client;
  socket.data.version = version;
  socket.data.role = 'GUEST';
  socket.data.sessionId = socket.id;
  if (socket.data.roomId === undefined) {
    socket.data.roomId = null;
  }

  logger.info(
    {
      event: CORE_HANDSHAKE_IN,
      socketId: socket.id,
      rid,
      ts: envelope.ts,
    },
    'WS core handshake received',
  );

  const response = emitEnvelope(
    socket,
    CORE_HANDSHAKE_OUT,
    {
      server: 'shrinevtt',
      role: socket.data.role,
      sessionId: socket.data.sessionId,
      roomId: socket.data.roomId,
    },
    { rid },
  );

  logger.info(
    {
      event: response.type,
      socketId: socket.id,
      rid: response.rid,
      ts: response.ts,
    },
    'WS core handshake response sent',
  );
}

function handlePing(socket, envelope, logger) {
  const { rid, ts } = envelope;

  logger.info(
    {
      event: CORE_PING,
      socketId: socket.id,
      rid,
      ts,
    },
    'WS core ping received',
  );

  const response = emitEnvelope(
    socket,
    CORE_PONG,
    { ts },
    { rid },
  );

  logger.info(
    {
      event: response.type,
      socketId: socket.id,
      rid: response.rid,
      ts: response.ts,
      payloadTs: response.payload?.ts,
    },
    'WS core pong sent',
  );
}

export default function registerCoreHandlers(namespace, { logger = log } = {}) {
  namespace.on('connection', (socket) => {
    if (socket.data.role === undefined) {
      socket.data.role = 'GUEST';
    }
    if (socket.data.roomId === undefined) {
      socket.data.roomId = null;
    }

    logger.info({ socketId: socket.id }, 'WS client connected');

    socket.on(WS_ENVELOPE_EVENT, (envelope) => {
      if (!envelope || typeof envelope !== 'object') {
        logger.warn({ socketId: socket.id }, 'WS received invalid envelope');
        return;
      }

      const { type } = envelope;
      if (!type) {
        logger.warn({ socketId: socket.id }, 'WS envelope missing type');
        return;
      }

      switch (type) {
        case CORE_HANDSHAKE_IN:
          handleHandshake(socket, envelope, logger);
          break;
        case CORE_PING:
          handlePing(socket, envelope, logger);
          break;
        default:
          logger.warn({ socketId: socket.id, type }, 'WS received unknown event type');
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, reason }, 'WS client disconnected');
    });
  });
}
