import { Router } from 'express';
import type { QuotaResponse } from '@app/shared';
import { requireAuth } from '../middleware/auth';
import { getQuota } from '../services/quota';

export const quotaRouter = Router();

// GET /api/quota — today's usage and limits (separate from /auth/me, which is cached longer).
quotaRouter.get('/', requireAuth, async (req, res) => {
  const body: QuotaResponse = { quota: await getQuota(req.auth!.userDoc) };
  res.json(body);
});
