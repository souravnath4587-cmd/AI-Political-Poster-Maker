import sharp, { type Metadata } from 'sharp';
import { toBanglaDigits, UPLOAD_RULES, type UploadKind } from '@app/shared';
import { HttpError } from '../lib/httpError';

/** Largest side stored: enough for the biggest A3 frame (~1300 px) with room to crop. */
const MAX_SIDE: Record<UploadKind, number> = { leader: 2000, requester: 2000, symbol: 1000 };
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp']);

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  lowResolution: boolean;
  /** Small JPEG copy for face detection (fewer tokens than the full image). */
  preview: Buffer;
}

/**
 * Validates and normalizes an uploaded photo: checks the real format (not the declared MIME
 * type), applies EXIF rotation, rejects photos that are too small, downsizes very large ones and
 * strips all metadata (GPS location, camera details) by re-encoding.
 */
export async function processUpload(input: Buffer, kind: UploadKind): Promise<ProcessedImage> {
  let meta: Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new HttpError(400, 'UNSUPPORTED_IMAGE', 'Not a readable image');
  }
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) {
    throw new HttpError(
      400,
      'UNSUPPORTED_IMAGE',
      `Unsupported image format: ${meta.format ?? 'unknown'}`,
    );
  }

  // .rotate() with no argument applies the EXIF orientation, so phone photos stand upright.
  const upright = sharp(input).rotate();
  // EXIF orientations 5–8 are quarter turns: the upright image has width and height swapped.
  const quarterTurn = (meta.orientation ?? 1) >= 5;
  const width = (quarterTurn ? meta.height : meta.width) ?? 0;
  const height = (quarterTurn ? meta.width : meta.height) ?? 0;

  const rules = UPLOAD_RULES[kind];
  const shortSide = Math.min(width, height);
  if (shortSide < rules.minSide) {
    throw new HttpError(400, 'IMAGE_TOO_SMALL', 'Image is too small', {
      minSide: rules.minSide,
      minSideBn: toBanglaDigits(rules.minSide),
      width,
      height,
    });
  }

  const resized = upright.clone().resize({
    width: MAX_SIDE[kind],
    height: MAX_SIDE[kind],
    fit: 'inside',
    withoutEnlargement: true,
  });
  // Symbols keep transparency (PNG); photos become JPEG. Metadata is dropped unless asked for.
  const output =
    kind === 'symbol' && meta.hasAlpha
      ? await resized.png({ compressionLevel: 8 }).toBuffer({ resolveWithObject: true })
      : await resized
          .flatten({ background: '#ffffff' })
          .jpeg({ quality: 88, mozjpeg: true })
          .toBuffer({ resolveWithObject: true });

  const preview = await sharp(output.data)
    .resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  return {
    buffer: output.data,
    width: output.info.width,
    height: output.info.height,
    lowResolution: shortSide < rules.warnBelow,
    preview,
  };
}
