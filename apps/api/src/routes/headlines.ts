import { Router } from 'express';
import mongoose from 'mongoose';
import {
  headlineSuggestSchema,
  layoutConfigSchema,
  type HeadlineSuggestResponse,
  type OccasionType,
} from '@app/shared';
import { HttpError } from '../lib/httpError';
import { parseBody } from '../lib/validate';
import { requireAuth } from '../middleware/auth';
import { Template } from '../models/Template';
import { suggestHeadlines } from '../services/headlines';
import { getQuota } from '../services/quota';

export const headlinesRouter = Router();

// POST /api/headlines/suggest { templateId, context? }
headlinesRouter.post('/suggest', requireAuth, async (req, res) => {
  const { templateId, context } = parseBody(headlineSuggestSchema, req.body);
  const template = mongoose.isValidObjectId(templateId)
    ? await Template.findOne(
        { _id: templateId, isActive: true },
        'occasionType layoutConfig',
      ).lean<{
        occasionType: OccasionType;
        layoutConfig: unknown;
      }>()
    : null;
  if (!template) throw new HttpError(404, 'TEMPLATE_NOT_FOUND', 'Template not found');

  const user = req.auth!.userDoc;
  const suggestions = await suggestHeadlines(
    user,
    {
      occasionType: template.occasionType,
      defaultHeadline: layoutConfigSchema.parse(template.layoutConfig).defaults.headline,
    },
    context,
  );

  const quota = await getQuota(user);
  const body: HeadlineSuggestResponse = { suggestions, remaining: quota.headlines.remaining };
  res.json(body);
});
