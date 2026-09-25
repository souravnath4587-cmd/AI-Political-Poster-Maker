import type { UploadApiResponse } from 'cloudinary';
import { cloudinary } from '../config/cloudinary';
import { env } from '../config/env';
import { HttpError } from '../lib/httpError';

export interface StoredImage {
  publicId: string;
  version: number;
  format: string;
  width: number;
  height: number;
  bytes: number;
}

function assertConfigured(): void {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new HttpError(503, 'STORAGE_UNAVAILABLE', 'Image storage is not configured');
  }
}

/**
 * Uploads an image as a private ("authenticated") asset: it can only be fetched with a
 * signed URL from signedImageUrl().
 */
export function storeImage(
  buffer: Buffer,
  options: { folder: string; tags?: string[] },
): Promise<StoredImage> {
  assertConfigured();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        type: 'authenticated',
        resource_type: 'image',
        unique_filename: true,
        overwrite: false,
        tags: options.tags,
      },
      (error, result?: UploadApiResponse) => {
        if (error || !result) {
          reject(new HttpError(502, 'STORAGE_ERROR', error?.message ?? 'Upload failed'));
          return;
        }
        resolve({
          publicId: result.public_id,
          version: result.version,
          format: result.format,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
        });
      },
    );
    stream.end(buffer);
  });
}

/**
 * Signed delivery URL for a private asset. The signature covers the public id, version and
 * transformation, so the URL can't be guessed or altered. It doesn't expire (Cloudinary's
 * expiring tokens need a paid plan); it's only ever given to the photo's owner and the renderer.
 */
export function signedImageUrl(
  image: Pick<StoredImage, 'publicId' | 'version' | 'format'>,
  transformation?: Record<string, unknown>,
): string {
  return cloudinary.url(image.publicId, {
    type: 'authenticated',
    resource_type: 'image',
    sign_url: true,
    secure: true,
    version: image.version,
    format: image.format,
    ...(transformation ? { transformation: [transformation] } : {}),
  });
}

/** Deletes a private asset (when its poster or upload is deleted, R8). */
export async function deleteImage(publicId: string): Promise<void> {
  assertConfigured();
  await cloudinary.uploader.destroy(publicId, { type: 'authenticated', invalidate: true });
}
