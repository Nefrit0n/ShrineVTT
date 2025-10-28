import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createErrorHandler, notFoundHandler, HttpError } from '../errors.js';
import healthRouter from './routes/health.js';
import createAuthRouter from './routes/auth.js';
import readmeRouter from './routes/readme.js';
import createSessionsRouter from './routes/sessions.js';

const staticDir = path.resolve(
  fileURLToPath(new URL('../../../frontend/dist', import.meta.url)),
);

export function createApp({ logger, userRepository, sessionRepository, jwt }) {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: '*' })); // Упрощённый CORS для MVP
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/health', healthRouter);

  if (!userRepository) throw new Error('userRepository dependency is required');
  if (!sessionRepository) throw new Error('sessionRepository dependency is required');
  if (!jwt) throw new Error('jwt dependency is required');

  app.use('/api/auth', createAuthRouter({ userRepository, jwt, logger }));
  app.use('/api/sessions', createSessionsRouter({ sessionRepository, jwt, logger }));
  app.use('/api', readmeRouter);

  app.use(express.static(staticDir));

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}

export default createApp;
