import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { HttpError } from '../lib/httpError';
import { processUpload } from './imageProcessing';

const solid = (width: number, height: number, alpha = false) =>
  sharp({
    create: {
      width,
      height,
      channels: alpha ? 4 : 3,
      background: alpha ? { r: 200, g: 0, b: 0, alpha: 0.5 } : '#3366aa',
    },
  });

async function errorCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (err) {
    return err instanceof HttpError ? err.code : 'not-an-HttpError';
  }
}

describe('processUpload', () => {
  it('applies EXIF rotation and strips all metadata', async () => {
    // Stored 1200×800 landscape with "rotate 90°" (orientation 6), plus a GPS-style EXIF tag.
    const input = await solid(1200, 800)
      .jpeg()
      .withExif({ IFD0: { Copyright: 'someone', ImageDescription: 'GPS here' } })
      .withMetadata({ orientation: 6 })
      .toBuffer();
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const result = await processUpload(input, 'leader');
    const meta = await sharp(result.buffer).metadata();

    expect([meta.width, meta.height]).toEqual([800, 1200]); // upright portrait
    expect(meta.format).toBe('jpeg');
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
  });

  it('rejects photos smaller than the minimum, using the upright size', async () => {
    const small = await solid(1000, 300).png().toBuffer();
    expect(await errorCode(processUpload(small, 'leader'))).toBe('IMAGE_TOO_SMALL');
  });

  it('flags photos below the print recommendation as low resolution', async () => {
    const medium = await solid(600, 600).jpeg().toBuffer();
    expect((await processUpload(medium, 'leader')).lowResolution).toBe(true);
    const large = await solid(1200, 1500).jpeg().toBuffer();
    expect((await processUpload(large, 'leader')).lowResolution).toBe(false);
  });

  it('downsizes very large photos', async () => {
    const huge = await solid(4000, 3000).jpeg().toBuffer();
    const result = await processUpload(huge, 'requester');
    expect(Math.max(result.width, result.height)).toBe(2000);
  });

  it('keeps transparency for party symbols', async () => {
    const logo = await solid(300, 300, true).png().toBuffer();
    const result = await processUpload(logo, 'symbol');
    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe('png');
    expect(meta.hasAlpha).toBe(true);
  });

  it('rejects files that are not images or are in other formats', async () => {
    expect(await errorCode(processUpload(Buffer.from('not an image'), 'leader'))).toBe(
      'UNSUPPORTED_IMAGE',
    );
    const gif = await solid(600, 600).gif().toBuffer();
    expect(await errorCode(processUpload(gif, 'leader'))).toBe('UNSUPPORTED_IMAGE');
  });

  it('makes a small preview for face detection', async () => {
    const input = await solid(1600, 1200).jpeg().toBuffer();
    const { preview } = await processUpload(input, 'leader');
    const meta = await sharp(preview).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBe(768);
  });
});
