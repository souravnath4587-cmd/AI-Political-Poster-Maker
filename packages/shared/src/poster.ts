import { z } from 'zod';
import type { OutputSize } from './render';
import type { OccasionType, PhotoField, TextField } from './template';
import type { UploadKind } from './upload';

// ---------------------------------------------------------------------------
// Form input
// ---------------------------------------------------------------------------

/** Longest accepted text per field. The template's text fitting is tested at these lengths. */
export const TEXT_LIMITS: Record<TextField, number> = {
  headline: 80,
  message: 300,
  name: 60,
  designation: 60,
  organization: 80,
  location: 80,
  leader1Name: 60,
  leader1Title: 60,
  leader2Name: 60,
  leader2Title: 60,
};

/** Fields the user must fill; the rest are optional or have template defaults. */
export const REQUIRED_TEXT_FIELDS = ['name', 'designation'] as const satisfies readonly TextField[];

/** Which upload kind each photo slot takes. */
export const PHOTO_FIELD_KIND: Record<PhotoField, UploadKind> = {
  leader1Photo: 'leader',
  leader2Photo: 'leader',
  requesterPhoto: 'requester',
  partySymbol: 'symbol',
};

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');

const textValue = (field: TextField) =>
  z
    .string()
    .trim()
    // Collapse runs of spaces/newlines (except in the message, where line breaks are allowed).
    .transform((v) => (field === 'message' ? v.replace(/[ \t]+/g, ' ') : v.replace(/\s+/g, ' ')))
    .pipe(z.string().max(TEXT_LIMITS[field], 'TEXT_TOO_LONG'));

const textSchema = z.object(
  Object.fromEntries(
    (Object.keys(TEXT_LIMITS) as TextField[]).map((field) => [field, textValue(field).optional()]),
  ) as Record<TextField, z.ZodOptional<ReturnType<typeof textValue>>>,
);

export const posterTextSchema = textSchema.superRefine((text, ctx) => {
  for (const field of REQUIRED_TEXT_FIELDS) {
    if (!text[field]) ctx.addIssue({ code: 'custom', path: [field], message: 'FIELD_REQUIRED' });
  }
});
export type PosterText = z.infer<typeof posterTextSchema>;

export const posterPhotosSchema = z.object({
  leader1Photo: objectId.optional(),
  leader2Photo: objectId.optional(),
  requesterPhoto: objectId.optional(),
  partySymbol: objectId.optional(),
});
export type PosterPhotoIds = z.infer<typeof posterPhotosSchema>;

/** POST /api/posters */
export const createPosterSchema = z.object({
  templateId: objectId,
  text: posterTextSchema,
  /** Upload ids from POST /api/upload. */
  photos: posterPhotosSchema,
});
export type CreatePosterInput = z.input<typeof createPosterSchema>;

/** POST /api/posters/:id/regenerate — changed text and/or photos; omitted parts stay as they are. */
export const regeneratePosterSchema = z.object({
  text: posterTextSchema.optional(),
  photos: posterPhotosSchema.optional(),
});
export type RegeneratePosterInput = z.input<typeof regeneratePosterSchema>;

export const downloadQuerySchema = z.object({
  size: z.enum(['a3', 'social45']).default('a3'),
});

// ---------------------------------------------------------------------------
// API responses
// ---------------------------------------------------------------------------

export interface PosterPhotoDto {
  uploadId: string;
  url: string;
  faceDetected: boolean;
  lowResolution: boolean;
}

export interface PosterDto {
  id: string;
  template: { id: string; title: string; occasionType: OccasionType };
  status: 'completed' | 'failed';
  text: PosterText;
  photos: Partial<Record<PhotoField, PosterPhotoDto>>;
  /** Signed URL of the 4:5 image (shown in the app). */
  previewUrl: string | null;
  /** Download links through the API (they render A3 on first use). */
  downloads: Record<OutputSize, string>;
  watermarked: boolean;
  editCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PosterResponse {
  poster: PosterDto;
}

export interface PosterListResponse {
  posters: PosterDto[];
}

export const POSTER_ERROR_CODES = [
  'TEMPLATE_NOT_FOUND',
  'PHOTO_REQUIRED',
  'PHOTO_NOT_FOUND',
  'PHOTO_WRONG_KIND',
  'FIELD_REQUIRED',
  'TEXT_TOO_LONG',
  'RENDER_FAILED',
  'POSTER_NOT_FOUND',
] as const;
