import { resolve } from 'node:path';
import { Router } from 'express';
import mongoose from 'mongoose';
import {
  layoutConfigSchema,
  templateListQuerySchema,
  templateRequirements,
  type TemplateSummary,
} from '@app/shared';
import { ASSETS_DIR } from '../lib/assets';
import { HttpError } from '../lib/httpError';
import { Template } from '../models/Template';

export const templatesRouter = Router();

const THUMBNAILS_DIR = resolve(ASSETS_DIR, 'thumbnails');

type TemplateRecord = {
  _id: mongoose.Types.ObjectId;
  slug: string;
  title: string;
  occasionType: TemplateSummary['occasionType'];
  description: string;
  thumbnailUrl: string;
  layoutConfig: unknown;
};

function toSummary(doc: TemplateRecord): TemplateSummary {
  return {
    id: doc._id.toString(),
    slug: doc.slug,
    title: doc.title,
    occasionType: doc.occasionType,
    description: doc.description,
    thumbnailUrl: doc.thumbnailUrl,
    requirements: templateRequirements(layoutConfigSchema.parse(doc.layoutConfig)),
  };
}

// GET /api/templates?occasion=victory_day
templatesRouter.get('/', async (req, res) => {
  const { occasion } = templateListQuerySchema.parse(req.query);
  const docs = await Template.find({
    isActive: true,
    ...(occasion ? { occasionType: occasion } : {}),
  })
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean<TemplateRecord[]>();
  res.json({ templates: docs.map(toSummary) });
});

// GET /api/templates/thumbnails/victory-day-classic.webp
templatesRouter.get('/thumbnails/:file', (req, res, next) => {
  const { file } = req.params;
  if (!/^[a-z0-9-]+\.webp$/.test(file)) {
    next(new HttpError(404, 'NOT_FOUND', 'Thumbnail not found'));
    return;
  }
  res.sendFile(file, { root: THUMBNAILS_DIR, maxAge: '1d' }, (err) => {
    if (err) next(new HttpError(404, 'NOT_FOUND', 'Thumbnail not found'));
  });
});

// GET /api/templates/:id — summary plus default texts (for the poster form's placeholders)
templatesRouter.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id))
    throw new HttpError(404, 'TEMPLATE_NOT_FOUND', 'Template not found');

  const doc = await Template.findOne({ _id: id, isActive: true }).lean<TemplateRecord>();
  if (!doc) throw new HttpError(404, 'TEMPLATE_NOT_FOUND', 'Template not found');

  const config = layoutConfigSchema.parse(doc.layoutConfig);
  res.json({ template: { ...toSummary(doc), defaults: config.defaults } });
});
