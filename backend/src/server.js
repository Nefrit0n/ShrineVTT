import config from './config.js';
import createApp from './http/app.js';
import log from './log.js';
import createWsServer from './ws/index.js';

const app = createApp({ logger: log });

const server = app.listen(config.port, () => {
  log.info({ port: config.port }, 'Server listening');
});

createWsServer(server, { logger: log });

server.on('error', (err) => {
  log.error({ err }, 'HTTP server error');
  process.exitCode = 1;
});

process.on('unhandledRejection', (err) => {
  log.error({ err }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  log.error({ err }, 'Uncaught exception');
  process.exit(1);
});
