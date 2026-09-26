import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { isProduction } from './config/env';
import { logger } from './lib/logger';
import { errorHandler, notFound } from './middleware/errorHandler';
import { originCheck } from './middleware/originCheck';
import { createRateLimits } from './middleware/rateLimits';
import { authRouter } from './routes/auth';
import { devRouter } from './routes/dev';
import { headlinesRouter } from './routes/headlines';
import { healthRouter } from './routes/health';
import { paymentsRouter } from './routes/payments';
import { postersRouter } from './routes/posters';
import { quotaRouter } from './routes/quota';
import { templatesRouter } from './routes/templates';
import { uploadRouter } from './routes/upload';

export function createApp() {
  const app = express();

  // Behind Render's proxy (and the Vercel rewrite): trust the first hop for IP and HTTPS.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/api/health' },
      // Session tokens must never reach the logs.
      redact: ['req.headers.cookie', 'res.headers["set-cookie"]'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(originCheck);

  const limits = createRateLimits();
  app.use('/api/auth/otp/request', limits.otpRequest);
  app.use('/api/auth/otp/verify', limits.otpVerify);
  app.use('/api/upload', limits.upload);
  app.use('/api/posters', limits.posterWrites);
  app.use('/api/headlines', limits.headlines);
  app.use('/api/payments', limits.payments);

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/templates', templatesRouter);
  app.use('/api/upload', uploadRouter);
  app.use('/api/posters', postersRouter);
  app.use('/api/quota', quotaRouter);
  app.use('/api/headlines', headlinesRouter);
  app.use('/api/payments', paymentsRouter);
  if (!isProduction) app.use('/api/dev', devRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
