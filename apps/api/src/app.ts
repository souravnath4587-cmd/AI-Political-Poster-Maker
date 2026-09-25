import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { isProduction } from './config/env';
import { logger } from './lib/logger';
import { errorHandler, notFound } from './middleware/errorHandler';
import { devRouter } from './routes/dev';
import { healthRouter } from './routes/health';

export function createApp() {
  const app = express();

  // Behind Render's proxy (and the Vercel rewrite): trust the first hop for IP and HTTPS.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/health', healthRouter);
  if (!isProduction) app.use('/api/dev', devRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
