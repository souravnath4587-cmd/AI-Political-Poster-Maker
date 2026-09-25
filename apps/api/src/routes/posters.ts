import { Router } from 'express';
import {
  createPosterSchema,
  downloadQuerySchema,
  regeneratePosterSchema,
  type PosterListResponse,
  type PosterResponse,
} from '@app/shared';
import { HttpError } from '../lib/httpError';
import { parseBody } from '../lib/validate';
import { requireAuth } from '../middleware/auth';
import { Poster, type PosterDoc } from '../models/Poster';
import {
  createPoster,
  ensureOutput,
  findOwnPoster,
  regeneratePoster,
  toPosterDto,
} from '../services/posters';
import { signedImageUrl } from '../services/storage';

export const postersRouter = Router();
postersRouter.use(requireAuth);

// POST /api/posters — render the 4:5 poster now; A3 is rendered on first download.
postersRouter.post('/', async (req, res) => {
  const input = parseBody(createPosterSchema, req.body);
  const poster = await createPoster(req.auth!.userDoc, input);
  const body: PosterResponse = { poster: await toPosterDto(poster) };
  res.status(201).json(body);
});

// GET /api/posters/me — the user's posters, newest first. (Declared before /:id.)
postersRouter.get('/me', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const posters = await Poster.find({ userId: req.auth!.userDoc._id, status: 'completed' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<PosterDoc[]>();
  const body: PosterListResponse = { posters: await Promise.all(posters.map(toPosterDto)) };
  res.json(body);
});

// GET /api/posters/:id — only the owner gets it; everyone else gets 404.
postersRouter.get('/:id', async (req, res) => {
  const poster = await findOwnPoster(req.auth!.userDoc, req.params.id);
  const body: PosterResponse = { poster: await toPosterDto(poster) };
  res.json(body);
});

// POST /api/posters/:id/regenerate { text?, photos? }
postersRouter.post('/:id/regenerate', async (req, res) => {
  const changes = parseBody(regeneratePosterSchema, req.body);
  if (!changes.text && !changes.photos) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Nothing to change');
  }
  const poster = await regeneratePoster(req.auth!.userDoc, req.params.id, changes);
  const body: PosterResponse = { poster: await toPosterDto(poster) };
  res.json(body);
});

// GET /api/posters/:id/download?size=a3|social45 → redirect to a signed "save as" link.
postersRouter.get('/:id/download', async (req, res) => {
  const { size } = downloadQuerySchema.parse(req.query);
  const user = req.auth!.userDoc;
  const poster = await findOwnPoster(user, req.params.id);
  const image = await ensureOutput(user, poster, size);

  const filename = `poster-${poster._id.toString().slice(-6)}-${size === 'a3' ? 'A3' : '4x5'}`;
  const url = signedImageUrl(image, { flags: `attachment:${filename}` });
  // ?format=json lets the app show progress while A3 renders, then start the download itself.
  if (req.query.format === 'json') res.json({ url });
  else res.redirect(302, url);
});
