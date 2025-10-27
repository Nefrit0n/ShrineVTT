import { Server } from 'socket.io';
import log from '../log.js';
import registerWsMiddleware from './middleware.js';
import registerCoreHandlers from './handlers/core.js';
import registerCommandHandlers from './handlers/commands.js';

const WS_NAMESPACE = '/ws';

export default function createWsServer(httpServer, { logger = log, jwt } = {}) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  const namespace = io.of(WS_NAMESPACE);

  registerWsMiddleware(namespace, { logger, jwt });
  registerCoreHandlers(namespace, { logger });
  registerCommandHandlers(namespace, { logger });

  logger.info({ namespace: WS_NAMESPACE }, 'WS namespace initialized');

  return io;
}
