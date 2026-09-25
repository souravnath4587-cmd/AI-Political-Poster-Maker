// Development-only routes (not mounted in production).
import { Router } from 'express';
import { z } from 'zod';
import { outputSizeSchema } from '@app/shared';
import { renderPoster } from '../services/render';
import { buildTestPosterHtml, SAMPLE_POSTER, TEST_POSTER_FONTS } from '../render/testPoster';

export const devRouter = Router();

const renderTestQuery = z.object({
  size: outputSizeSchema.default('social45'),
  headline: z.string().max(200).optional(),
  message: z.string().max(1000).optional(),
  name: z.string().max(200).optional(),
  designation: z.string().max(200).optional(),
});

// GET /api/dev/render-test?size=a3&name=… → PNG of the hard-coded test poster.
devRouter.get('/render-test', async (req, res) => {
  const q = renderTestQuery.parse(req.query);
  const html = buildTestPosterHtml({
    ...SAMPLE_POSTER,
    headline: q.headline ?? SAMPLE_POSTER.headline,
    message: q.message ?? SAMPLE_POSTER.message,
    requester: {
      ...SAMPLE_POSTER.requester,
      name: q.name ?? SAMPLE_POSTER.requester.name,
      designation: q.designation ?? SAMPLE_POSTER.requester.designation,
    },
  });

  const result = await renderPoster(html, { size: q.size, requiredFonts: TEST_POSTER_FONTS });

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
