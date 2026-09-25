// Development-only routes (not mounted in production).
import { Router } from 'express';
import { z } from 'zod';
import { layoutConfigSchema, outputSizeSchema, textFieldSchema } from '@app/shared';
import { HttpError } from '../lib/httpError';
import { buildPosterHtml } from '../render/posterHtml';
import { renderPoster } from '../services/render';
import { SAMPLE_CONTENT, TEMPLATE_SEEDS } from '../templates';

export const devRouter = Router();

const renderTestQuery = z.object({
  template: z.string().default(TEMPLATE_SEEDS[0]!.slug),
  size: outputSizeSchema.default('social45'),
  /** Leave leader 2 out to see the one-leader layout. */
  solo: z.stringbool().default(false),
});

// Any text field can be overridden, e.g. ?name=…&headline=…
const textOverrides = z.partialRecord(textFieldSchema, z.string().max(300));

// GET /api/dev/render-test?template=mourning-tribute&size=a3&name=… → PNG
devRouter.get('/render-test', async (req, res) => {
  const q = renderTestQuery.parse(req.query);
  const seed = TEMPLATE_SEEDS.find((s) => s.slug === q.template);
  if (!seed) throw new HttpError(404, 'TEMPLATE_NOT_FOUND', `No template "${q.template}"`);

  const overrides = textOverrides.parse(
    Object.fromEntries(
      textFieldSchema.options.filter((f) => f in req.query).map((f) => [f, req.query[f]]),
    ),
  );
  const { html, requiredFonts } = buildPosterHtml(
    layoutConfigSchema.parse(seed.layoutConfig),
    q.size,
    {
      text: { ...SAMPLE_CONTENT.text, ...overrides },
      photos: { ...SAMPLE_CONTENT.photos, ...(q.solo ? { leader2Photo: undefined } : {}) },
    },
  );

  const result = await renderPoster(html, { size: q.size, requiredFonts });

  res
    .set({
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
      'X-Render-Ms': String(result.renderMs),
      'X-Text-Overflow':
        result.fit
          .filter((f) => f.overflow)
          .map((f) => f.id)
          .join(',') || 'none',
    })
    .send(result.png);
});
