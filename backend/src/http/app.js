import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createErrorHandler, notFoundHandler } from '../errors.js';
import healthRouter from './routes/health.js';

const staticDir = path.resolve(
  fileURLToPath(new URL('../../../frontend/dist', import.meta.url)),
);

export function createApp({ logger }) {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/health', healthRouter);

  app.use(express.static(staticDir));

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}

export default createApp;
