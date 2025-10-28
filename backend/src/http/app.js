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
import createPlayerStateRouter from './routes/playerState.js';
import createScenesRouter from './routes/scenes.js';

const staticDir = path.resolve(
  fileURLToPath(new URL('../../../frontend/dist', import.meta.url)),
);

export function createApp({
  logger,
  userRepository,
  sessionRepository,
  playerStateRepository,
  sceneRepository,
  sessionService,
  sceneQueries,
  jwt,
}) {
  const app = express();

  const defaultCspDirectives = helmet.contentSecurityPolicy.getDefaultDirectives();
  const scriptSrc = defaultCspDirectives['script-src'] || ["'self'"];
  const connectSrc = defaultCspDirectives['connect-src'] || ["'self'"];

  const directives = {
    ...defaultCspDirectives,
    'script-src': Array.from(new Set([...scriptSrc, 'https://cdn.jsdelivr.net'])),
  };

  if (process.env.NODE_ENV !== 'production') {
    directives['connect-src'] = Array.from(
      new Set([
        ...connectSrc,
        'http://localhost:*',
        'http://127.0.0.1:*',
        'ws://localhost:*',
        'ws://127.0.0.1:*',
      ]),
    );
  }

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives,
      },
    }),
  );
  app.use(cors({ origin: '*' })); // Упрощённый CORS для MVP
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/health', healthRouter);

  if (!userRepository) throw new Error('userRepository dependency is required');
  if (!sessionRepository) throw new Error('sessionRepository dependency is required');
  if (!playerStateRepository) throw new Error('playerStateRepository dependency is required');
  if (!sceneRepository) throw new Error('sceneRepository dependency is required');
  if (!sessionService) throw new Error('sessionService dependency is required');
  if (!sceneQueries) throw new Error('sceneQueries dependency is required');
  if (!jwt) throw new Error('jwt dependency is required');

  app.use('/api/auth', createAuthRouter({ userRepository, jwt, logger }));
  app.use(
    '/api/sessions',
    createSessionsRouter({ sessionRepository, playerStateRepository, jwt, logger }),
  );
  app.use(
    '/api/sessions/:sessionId/player-state',
    createPlayerStateRouter({ playerStateRepository, jwt, logger }),
  );
  app.use(
    '/api',
    createScenesRouter({
      sceneRepository,
      sessionRepository,
      sessionService,
      sceneQueries,
      jwt,
      logger,
    }),
  );
  app.use('/api', readmeRouter);

  app.get('/favicon.ico', (req, res) => {
    res.status(204).end();
  });

  app.use(express.static(staticDir));

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}

export default createApp;
