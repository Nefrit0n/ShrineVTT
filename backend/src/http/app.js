import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createErrorHandler, notFoundHandler, HttpError } from '../errors.js';
import healthRouter from './routes/health.js';
import createAuthRouter from './routes/auth.js';
import readmeRouter from './routes/readme.js';

const staticDir = path.resolve(
  fileURLToPath(new URL('../../../frontend/dist', import.meta.url)),
);

export function createApp({ logger, userRepository, jwt }) {
  const app = express();

  const allowedOrigins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const corsOptions = {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.length === 0) {
        callback(
          new HttpError(403, 'CORS origin not configured', {
            code: 'CORS_ORIGIN_FORBIDDEN',
          }),
        );
        return;
      }

      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(
        new HttpError(403, 'CORS origin denied', {
          code: 'CORS_ORIGIN_FORBIDDEN',
        }),
      );
    },
    credentials: true,
  };

  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/health', healthRouter);
  if (!userRepository) {
    throw new Error('userRepository dependency is required');
  }
  if (!jwt) {
    throw new Error('jwt dependency is required');
  }
  app.use('/api/auth', createAuthRouter({ userRepository, jwt, logger }));
  app.use('/api', readmeRouter);

  app.use(express.static(staticDir));

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}

export default createApp;
