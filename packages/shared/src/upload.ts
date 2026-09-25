import { z } from 'zod';

export const uploadKindSchema = z.enum(['leader', 'requester', 'symbol']);
export type UploadKind = z.infer<typeof uploadKindSchema>;

/**
 * Size rules per kind, on the image's shortest side (px).
 * A leader's frame on the A3 poster is ~28% of 3508 px ≈ 1000 px, so smaller photos get
 * upscaled when printed: below `warnBelow` the user is warned, below `minSide` it's rejected.
 */
export const UPLOAD_RULES: Record<UploadKind, { minSide: number; warnBelow: number }> = {
  leader: { minSide: 400, warnBelow: 900 },
  requester: { minSide: 400, warnBelow: 700 },
  symbol: { minSide: 150, warnBelow: 400 },
};

export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
export const UPLOAD_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** A point in the photo as percentages of its width and height (0–100). */
export interface FocusPoint {
  x: number;
  y: number;
}

export interface UploadDto {
  id: string;
  kind: UploadKind;
  /** Signed Cloudinary URL (uploads are private: unsigned URLs are refused). */
  url: string;
  width: number;
  height: number;
  /** Where to center the crop: the detected face, or a default slightly above the middle. */
  focus: FocusPoint;
  faceDetected: boolean;
  /** Smaller than recommended for print; the UI should warn. */
  lowResolution: boolean;
}

export interface UploadResponse {
  upload: UploadDto;
}

export const UPLOAD_ERROR_CODES = [
  'NO_FILE',
  'FILE_TOO_LARGE',
  'UNSUPPORTED_IMAGE',
  'IMAGE_TOO_SMALL',
] as const;
