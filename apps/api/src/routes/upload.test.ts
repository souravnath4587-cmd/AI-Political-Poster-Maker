import sharp from 'sharp';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTestDb } from '../../test/db';
import { GenerationLog } from '../models/GenerationLog';
import { Upload } from '../models/Upload';

// No real Cloudinary calls in tests.
const storeImage = vi.fn();
vi.mock('../services/storage', () => ({
  storeImage: (...args: unknown[]) => storeImage(...args),
  signedImageUrl: (image: { publicId: string }) =>
    `https://res.cloudinary.com/demo/image/authenticated/s--sig--/${image.publicId}.jpg`,
}));

const { createApp } = await import('../app');

useTestDb();
const app = createApp();

async function loggedInAgent() {
  const phone = '01712345678';
  const { body } = await request(app).post('/api/auth/otp/request').send({ phone });
  const agent = request.agent(app);
  await agent
    .post('/api/auth/otp/verify')
    .send({ phone, code: body.devCode, acceptTerms: true })
    .expect(200);
  return agent;
}

const photo = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#8899aa' } })
    .jpeg()
    .toBuffer();

beforeEach(() => {
  storeImage.mockReset();
  storeImage.mockImplementation(async (buffer: Buffer, options: { folder: string }) => {
    const meta = await sharp(buffer).metadata();
    return {
      publicId: `${options.folder}/abc123`,
      version: 1,
      format: meta.format,
      width: meta.width,
      height: meta.height,
      bytes: buffer.length,
    };
  });
});

describe('POST /api/upload', () => {
  it('requires a session', async () => {
    const res = await request(app)
      .post('/api/upload')
      .field('kind', 'leader')
      .attach('photo', await photo(800, 800), 'a.jpg');
    expect(res.status).toBe(401);
  });

  it('stores a processed photo privately and returns a signed URL', async () => {
    const agent = await loggedInAgent();
    const res = await agent
      .post('/api/upload')
      .field('kind', 'leader')
      .attach('photo', await photo(1200, 1500), 'leader.jpg');

    expect(res.status).toBe(201);
    expect(res.body.upload).toMatchObject({
      kind: 'leader',
      width: 1200,
      height: 1500,
      // No GEMINI_API_KEY in tests: default crop, no AI call logged.
      focus: { x: 50, y: 40 },
      faceDetected: false,
      lowResolution: false,
    });
    expect(res.body.upload.url).toMatch(/\/authenticated\/s--/);

    const [, options] = storeImage.mock.calls[0]!;
    const doc = await Upload.findById(res.body.upload.id).lean();
    expect(options.folder).toBe(`uploads/${doc!.userId.toString()}`);
    expect(await GenerationLog.countDocuments()).toBe(0);
  });

  it('warns about low-resolution photos', async () => {
    const agent = await loggedInAgent();
    const res = await agent
      .post('/api/upload')
      .field('kind', 'leader')
      .attach('photo', await photo(600, 700), 'small.jpg');
    expect(res.status).toBe(201);
    expect(res.body.upload.lowResolution).toBe(true);
  });

  it('explains what is wrong with a bad upload', async () => {
    const agent = await loggedInAgent();

    const noFile = await agent.post('/api/upload').field('kind', 'leader');
    expect(noFile.body.error.code).toBe('NO_FILE');

    const badKind = await agent
      .post('/api/upload')
      .field('kind', 'banner')
      .attach('photo', await photo(800, 800), 'a.jpg');
    expect(badKind.body.error.code).toBe('VALIDATION_ERROR');

    const tooSmall = await agent
      .post('/api/upload')
      .field('kind', 'leader')
      .attach('photo', await photo(300, 300), 'tiny.jpg');
    expect(tooSmall.body.error).toMatchObject({ code: 'IMAGE_TOO_SMALL', minSide: 400 });

    const wrongType = await agent
      .post('/api/upload')
      .field('kind', 'leader')
      .attach('photo', Buffer.from('%PDF-1.4'), {
        filename: 'doc.pdf',
        contentType: 'application/pdf',
      });
    expect(wrongType.body.error.code).toBe('UNSUPPORTED_IMAGE');

    // Declared as JPEG but isn't one: the real format is checked.
    const fake = await agent
      .post('/api/upload')
      .field('kind', 'leader')
      .attach('photo', Buffer.from('definitely not a jpeg'), {
        filename: 'x.jpg',
        contentType: 'image/jpeg',
      });
    expect(fake.body.error.code).toBe('UNSUPPORTED_IMAGE');

    expect(storeImage).not.toHaveBeenCalled();
  });

  it('rejects files over 10 MB', async () => {
    const agent = await loggedInAgent();
    const res = await agent
      .post('/api/upload')
      .field('kind', 'leader')
      .attach('photo', Buffer.alloc(10 * 1024 * 1024 + 1), {
        filename: 'big.jpg',
        contentType: 'image/jpeg',
      });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
  });
});
