import mongoose from 'mongoose';
import {
  layoutConfigSchema,
  PHOTO_FIELD_KIND,
  PHOTO_FIELDS,
  templateRequirements,
  type LayoutConfig,
  type OutputSize,
  type PhotoField,
  type PosterDto,
  type PosterPhotoIds,
  type PosterText,
} from '@app/shared';
import { HttpError } from '../lib/httpError';
import { logger } from '../lib/logger';
import { GenerationLog } from '../models/GenerationLog';
import { Poster, type PosterDoc } from '../models/Poster';
import { Template } from '../models/Template';
import { Upload, type UploadDoc } from '../models/Upload';
import { effectivePlan, type UserDoc } from '../models/User';
import { buildPosterHtml, type PosterContent } from '../render/posterHtml';
import { renderPoster } from './render';
import { signedImageUrl, storeImage, type StoredImage } from './storage';

interface TemplateRecord {
  _id: mongoose.Types.ObjectId;
  title: string;
  occasionType: PosterDto['template']['occasionType'];
  layoutConfig: unknown;
}

/** Where a stored image lives; enough to build a signed URL. */
type ImageRef = Pick<StoredImage, 'publicId' | 'version' | 'format' | 'width' | 'height'>;

/** What a poster keeps of each photo it uses. */
interface PosterPhotoSnapshot {
  field: PhotoField;
  uploadId: mongoose.Types.ObjectId;
  image: ImageRef;
  focus: { x: number; y: number };
  faceDetected: boolean;
  lowResolution: boolean;
}

function snapshotsOf(poster: PosterDoc): PosterPhotoSnapshot[] {
  return poster.photos.map((p) => ({
    field: p.field,
    uploadId: p.uploadId,
    image: p.image,
    focus: { x: p.focus.x ?? 50, y: p.focus.y ?? 50 },
    faceDetected: p.faceDetected ?? false,
    lowResolution: p.lowResolution ?? false,
  }));
}

async function loadTemplate(templateId: mongoose.Types.ObjectId | string) {
  const doc = mongoose.isValidObjectId(templateId)
    ? await Template.findOne({ _id: templateId, isActive: true }).lean<TemplateRecord>()
    : null;
  if (!doc) throw new HttpError(404, 'TEMPLATE_NOT_FOUND', 'Template not found');
  return { doc, config: layoutConfigSchema.parse(doc.layoutConfig) };
}

/**
 * Checks the chosen uploads against the template: every required photo is there, each upload
 * belongs to the user and has the right kind for its slot. Returns snapshots to store on the poster.
 */
async function resolvePhotos(
  user: UserDoc,
  config: LayoutConfig,
  ids: PosterPhotoIds,
): Promise<PosterPhotoSnapshot[]> {
  const { photos: needed } = templateRequirements(config);
  const used = new Set(needed.map((p) => p.field));

  for (const { field, optional } of needed) {
    if (!optional && !ids[field]) {
      throw new HttpError(400, 'PHOTO_REQUIRED', `Photo "${field}" is required`, { field });
    }
  }

  // Photos for slots this template doesn't have are ignored.
  const chosen = PHOTO_FIELDS.filter((f) => used.has(f) && ids[f]);
  const uploads = await Upload.find({
    _id: { $in: chosen.map((f) => ids[f]!) },
    userId: user._id,
  }).lean<UploadDoc[]>();
  const byId = new Map(uploads.map((u) => [u._id.toString(), u]));

  return chosen.map((field) => {
    const upload = byId.get(ids[field]!);
    // Someone else's upload looks exactly like a missing one.
    if (!upload) throw new HttpError(400, 'PHOTO_NOT_FOUND', 'Photo not found', { field });
    if (upload.kind !== PHOTO_FIELD_KIND[field]) {
      throw new HttpError(400, 'PHOTO_WRONG_KIND', `Photo for "${field}" has the wrong kind`, {
        field,
      });
    }
    return {
      field,
      uploadId: upload._id,
      image: {
        publicId: upload.publicId,
        version: upload.version,
        format: upload.format,
        width: upload.width,
        height: upload.height,
      },
      focus: { x: upload.focus.x, y: upload.focus.y },
      faceDetected: upload.faceDetected ?? false,
      lowResolution: upload.lowResolution ?? false,
    };
  });
}

function contentFor(text: PosterText, photos: PosterPhotoSnapshot[]): PosterContent {
  return {
    text,
    photos: Object.fromEntries(
      photos.map((p) => [
        p.field,
        {
          url: signedImageUrl(p.image),
          width: p.image.width,
          height: p.image.height,
          focus: p.focus,
        },
      ]),
    ),
  };
}

/** Renders one size, stores it privately and logs the attempt. Throws RENDER_FAILED on failure. */
async function renderAndStore(
  user: UserDoc,
  posterId: mongoose.Types.ObjectId,
  config: LayoutConfig,
  size: OutputSize,
  content: PosterContent,
  watermark: boolean,
): Promise<StoredImage> {
  const started = performance.now();
  const log = (success: boolean, error?: string) =>
    GenerationLog.create({
      userId: user._id,
      posterId,
      stage: 'render',
      model: `puppeteer:${size}`,
      latencyMs: Math.round(performance.now() - started),
      success,
      error: error ?? null,
    }).catch((err: unknown) => logger.error({ err }, 'Could not write GenerationLog'));

  try {
    const { html, requiredFonts } = buildPosterHtml(config, size, content, { watermark });
    const result = await renderPoster(html, { size, requiredFonts });
    const overflow = result.fit.filter((f) => f.overflow).map((f) => f.id);
    if (overflow.length) logger.warn({ posterId, size, overflow }, 'Text overflow in render');

    const stored = await storeImage(result.png, {
      folder: `posters/${user._id.toString()}`,
      tags: ['poster', size],
    });
    void log(true);
    return stored;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    void log(false, message.slice(0, 500));
    logger.error({ err, posterId, size }, 'Poster render failed');
    throw new HttpError(500, 'RENDER_FAILED', 'The poster could not be created');
  }
}

export async function createPoster(
  user: UserDoc,
  input: { templateId: string; text: PosterText; photos: PosterPhotoIds },
): Promise<PosterDoc> {
  const { doc: template, config } = await loadTemplate(input.templateId);
  const photos = await resolvePhotos(user, config, input.photos);
  const watermark = effectivePlan(user) === 'free';

  // The id is needed before saving so the render log can point at the poster.
  const posterId = new mongoose.Types.ObjectId();
  const social45 = await renderAndStore(
    user,
    posterId,
    config,
    'social45',
    contentFor(input.text, photos),
    watermark,
  );

  const poster = await Poster.create({
    _id: posterId,
    userId: user._id,
    templateId: template._id,
    text: input.text,
    photos,
    outputs: { social45, a3: null },
    status: 'completed',
    watermarked: watermark,
  });
  return poster.toObject();
}

/** The user's own poster, or 404 (also for other users' posters, so ids can't be probed). */
export async function findOwnPoster(user: UserDoc, posterId: string): Promise<PosterDoc> {
  const poster = mongoose.isValidObjectId(posterId)
    ? await Poster.findOne({ _id: posterId, userId: user._id }).lean<PosterDoc>()
    : null;
  if (!poster) throw new HttpError(404, 'POSTER_NOT_FOUND', 'Poster not found');
  return poster;
}

/** Re-renders with changed text/photos; the old A3 is dropped and rendered again on download. */
export async function regeneratePoster(
  user: UserDoc,
  posterId: string,
  changes: { text?: PosterText; photos?: PosterPhotoIds },
): Promise<PosterDoc> {
  const poster = await findOwnPoster(user, posterId);
  const { config } = await loadTemplate(poster.templateId);

  const text = changes.text ?? (poster.text as PosterText);
  const currentIds = Object.fromEntries(
    poster.photos.map((p) => [p.field, p.uploadId.toString()]),
  ) as PosterPhotoIds;
  const photos = changes.photos
    ? await resolvePhotos(user, config, { ...currentIds, ...changes.photos })
    : snapshotsOf(poster);

  // The watermark follows the current plan, so an upgraded user gets a clean poster.
  const watermark = effectivePlan(user) === 'free';
  const social45 = await renderAndStore(
    user,
    poster._id,
    config,
    'social45',
    contentFor(text, photos),
    watermark,
  );

  const updated = await Poster.findOneAndUpdate(
    { _id: poster._id, userId: user._id },
    {
      $set: {
        text,
        photos,
        'outputs.social45': social45,
        'outputs.a3': null,
        watermarked: watermark,
      },
      $inc: { editCount: 1 },
    },
    { returnDocument: 'after' },
  ).lean<PosterDoc>();
  if (!updated) throw new HttpError(404, 'POSTER_NOT_FOUND', 'Poster not found');
  return updated;
}

/** The stored image for a size, rendering (and caching) it first if needed. */
export async function ensureOutput(
  user: UserDoc,
  poster: PosterDoc,
  size: OutputSize,
): Promise<ImageRef> {
  const existing = poster.outputs?.[size];
  if (existing) return existing;

  const { config } = await loadTemplate(poster.templateId);
  const stored = await renderAndStore(
    user,
    poster._id,
    config,
    size,
    contentFor(poster.text as PosterText, snapshotsOf(poster)),
    poster.watermarked,
  );
  await Poster.updateOne({ _id: poster._id }, { $set: { [`outputs.${size}`]: stored } });
  return stored;
}

export async function toPosterDto(poster: PosterDoc): Promise<PosterDto> {
  const template = await Template.findById(
    poster.templateId,
    'title occasionType',
  ).lean<TemplateRecord>();
  const base = `/api/posters/${poster._id.toString()}/download`;
  return {
    id: poster._id.toString(),
    template: {
      id: poster.templateId.toString(),
      title: template?.title ?? '',
      occasionType: template?.occasionType ?? 'victory_day',
    },
    status: poster.status,
    text: poster.text as PosterText,
    photos: Object.fromEntries(
      poster.photos.map((p) => [
        p.field as PhotoField,
        {
          uploadId: p.uploadId.toString(),
          url: signedImageUrl(p.image),
          faceDetected: p.faceDetected ?? false,
          lowResolution: p.lowResolution ?? false,
        },
      ]),
    ),
    previewUrl: poster.outputs?.social45 ? signedImageUrl(poster.outputs.social45) : null,
    downloads: { a3: `${base}?size=a3`, social45: `${base}?size=social45` },
    watermarked: poster.watermarked,
    editCount: poster.editCount ?? 0,
    createdAt: new Date(poster.createdAt).toISOString(),
    updatedAt: new Date(poster.updatedAt).toISOString(),
  };
}
