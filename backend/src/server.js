import 'dotenv/config';
import config from './config.js';
import createApp from './http/app.js';
import log from './log.js';
import createWsServer from './ws/index.js';
import db from './infra/db/sqlite.js';
import UserRepository, { seedTestUsers } from './infra/repositories/UserRepository.js';
import * as jwt from './auth/jwt.js';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET not set in environment');
}
if (!process.env.GM_PASSWORD) {
  log.warn('GM_PASSWORD not set: GM login will fail');
}

const userRepository = new UserRepository(db);
seedTestUsers(userRepository, { logger: log });

const app = createApp({ logger: log, userRepository, jwt });

const server = app.listen(config.port, () => {
  log.info({ port: config.port }, 'Server listening');
});

createWsServer(server, { logger: log, jwt });

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
