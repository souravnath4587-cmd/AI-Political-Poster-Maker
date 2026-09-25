import { Router } from 'express';
import type { HealthResponse } from '@app/shared';
import { isDbConnected } from '../config/db';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  const body: HealthResponse = {
    status: 'ok',
    service: 'api',
    uptimeSeconds: Math.round(process.uptime()),
    db: isDbConnected() ? 'connected' : 'disconnected',
  };
  res.json(body);
});
