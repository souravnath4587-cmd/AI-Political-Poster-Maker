import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTestDb } from '../../test/db';

// No Chromium or Cloudinary in these tests: rendering and storage are faked, and the fakes
// record what they were asked to do.
const renderCalls: { size: string; html: string }[] = [];
let renderShouldFail = false;
vi.mock('../services/render', () => ({
  renderPoster: async (html: string, { size }: { size: string }) => {
    renderCalls.push({ size, html });
    if (renderShouldFail) throw new Error('Chromium crashed');
    return { png: Buffer.from('png'), width: 1, height: 1, fit: [], renderMs: 1 };
  },
}));
let stored = 0;
vi.mock('../services/storage', () => ({
  storeImage: async (_buf: Buffer, { folder }: { folder: string }) => ({
    publicId: `${folder}/img${++stored}`,
    version: 1,
    format: 'png',
    width: 1080,
    height: 1350,
    bytes: 3,
  }),
  signedImageUrl: (image: { publicId: string }, t?: { flags?: string }) =>
    `https://res.cloudinary.com/demo/image/authenticated/s--sig--/${t?.flags ? `fl_${t.flags}/` : ''}${image.publicId}.png`,
}));

const { createApp } = await import('../app');
const { GenerationLog } = await import('../models/GenerationLog');
const { Poster } = await import('../models/Poster');
const { Template } = await import('../models/Template');
const { Upload } = await import('../models/Upload');
const { User } = await import('../models/User');
const { TEMPLATE_SEEDS } = await import('../templates');
const { WATERMARK_TEXT } = await import('../render/posterHtml');

useTestDb();
const app = createApp();

let victoryId: string;
let mourningId: string;

beforeEach(async () => {
  renderCalls.length = 0;
  renderShouldFail = false;
  const [victory, mourning] = await Promise.all(
    TEMPLATE_SEEDS.map((seed) =>
      Template.create({ ...seed, thumbnailUrl: `/t/${seed.slug}.webp` }),
    ),
  );
  victoryId = victory!._id.toString();
  mourningId = mourning!._id.toString();
});

async function login(phone: string) {
  const { body } = await request(app).post('/api/auth/otp/request').send({ phone });
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/otp/verify')
    .send({ phone, code: body.devCode, acceptTerms: true })
    .expect(200);
  return { agent, userId: res.body.user.id as string };
}

async function upload(userId: string, kind: 'leader' | 'requester' | 'symbol') {
  const doc = await Upload.create({
    userId,
    kind,
    publicId: `uploads/${userId}/${kind}-${new mongoose.Types.ObjectId().toString()}`,
    version: 1,
    format: 'jpg',
    width: 1200,
    height: 1500,
    bytes: 1000,
    focus: { x: 50, y: 30 },
    faceDetected: true,
  });
  return doc._id.toString();
}

async function victoryInput(userId: string) {
  return {
    templateId: victoryId,
    text: { name: 'মোঃ সাইফুল ইসলাম', designation: 'সাংগঠনিক সম্পাদক', organization: 'যুব সংগঠন' },
    photos: {
      leader1Photo: await upload(userId, 'leader'),
      requesterPhoto: await upload(userId, 'requester'),
    },
  };
}

describe('POST /api/posters', () => {
  it('requires a session', async () => {
    expect((await request(app).post('/api/posters').send({})).status).toBe(401);
  });

  it('renders the 4:5 poster with a watermark for free users and stores it privately', async () => {
    const { agent, userId } = await login('01712345678');
    const res = await agent.post('/api/posters').send(await victoryInput(userId));

    expect(res.status).toBe(201);
    const { poster } = res.body;
    expect(poster).toMatchObject({ status: 'completed', watermarked: true, editCount: 0 });
    expect(poster.template.title).toBe(TEMPLATE_SEEDS[0]!.title);
    expect(poster.previewUrl).toContain(`posters/${userId}/`);
    expect(poster.downloads.a3).toBe(`/api/posters/${poster.id}/download?size=a3`);
    expect(poster.photos.leader1Photo.faceDetected).toBe(true);

    expect(renderCalls.map((c) => c.size)).toEqual(['social45']);
    const html = renderCalls[0]!.html;
    expect(html.includes(WATERMARK_TEXT)).toBe(true);
    expect(html.includes('মোঃ সাইফুল ইসলাম')).toBe(true);
    // Leader 2 wasn't given: the one-leader layout is used.
    expect(html.includes('data-el="leader1PhotoSolo"')).toBe(true);

    const log = await GenerationLog.findOne({ posterId: poster.id }).lean();
    expect(log).toMatchObject({ stage: 'render', success: true, model: 'puppeteer:social45' });
  });

  it('leaves the watermark off for premium users', async () => {
    const { agent, userId } = await login('01712345678');
    await User.updateOne({ _id: userId }, { plan: 'premium' });
    const res = await agent.post('/api/posters').send(await victoryInput(userId));
    expect(res.body.poster.watermarked).toBe(false);
    expect(renderCalls[0]!.html.includes(WATERMARK_TEXT)).toBe(false);
  });

  it('checks the text fields', async () => {
    const { agent, userId } = await login('01712345678');
    const input = await victoryInput(userId);

    const noName = await agent.post('/api/posters').send({ ...input, text: { designation: 'x' } });
    expect(noName.body.error.code).toBe('FIELD_REQUIRED');

    const tooLong = await agent
      .post('/api/posters')
      .send({ ...input, text: { ...input.text, name: 'ক'.repeat(61) } });
    expect(tooLong.body.error.code).toBe('TEXT_TOO_LONG');
  });

  it('checks the photos against the template', async () => {
    const { agent, userId } = await login('01712345678');
    const input = await victoryInput(userId);

    const missing = await agent
      .post('/api/posters')
      .send({ ...input, photos: { requesterPhoto: input.photos.requesterPhoto } });
    expect(missing.body.error).toMatchObject({ code: 'PHOTO_REQUIRED', field: 'leader1Photo' });

    const wrongKind = await agent.post('/api/posters').send({
      ...input,
      photos: { ...input.photos, leader1Photo: await upload(userId, 'symbol') },
    });
    expect(wrongKind.body.error).toMatchObject({ code: 'PHOTO_WRONG_KIND', field: 'leader1Photo' });

    const other = await login('01812345678');
    const stolen = await agent.post('/api/posters').send({
      ...input,
      photos: { ...input.photos, leader1Photo: await upload(other.userId, 'leader') },
    });
    expect(stolen.body.error).toMatchObject({ code: 'PHOTO_NOT_FOUND', field: 'leader1Photo' });

    const noTemplate = await agent
      .post('/api/posters')
      .send({ ...input, templateId: new mongoose.Types.ObjectId().toString() });
    expect(noTemplate.body.error.code).toBe('TEMPLATE_NOT_FOUND');

    expect(renderCalls).toHaveLength(0);
  });

  it('ignores photos for slots the template does not have', async () => {
    const { agent, userId } = await login('01712345678');
    const input = await victoryInput(userId);
    const res = await agent.post('/api/posters').send({
      ...input,
      templateId: mourningId,
      photos: { ...input.photos, leader2Photo: await upload(userId, 'leader') },
    });
    expect(res.status).toBe(201);
    expect(Object.keys(res.body.poster.photos).sort()).toEqual(['leader1Photo', 'requesterPhoto']);
  });

  it('reports a failed render and saves nothing', async () => {
    const { agent, userId } = await login('01712345678');
    renderShouldFail = true;
    const res = await agent.post('/api/posters').send(await victoryInput(userId));
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('RENDER_FAILED');
    expect(await Poster.countDocuments()).toBe(0);
    expect(await GenerationLog.findOne({ success: false }).lean()).toMatchObject({
      stage: 'render',
      error: 'Chromium crashed',
    });
  });
});

describe('reading and downloading posters', () => {
  it('shows a poster only to its owner', async () => {
    const owner = await login('01712345678');
    const { body } = await owner.agent.post('/api/posters').send(await victoryInput(owner.userId));
    const id = body.poster.id;

    expect((await owner.agent.get(`/api/posters/${id}`)).status).toBe(200);
    const stranger = await login('01812345678');
    expect((await stranger.agent.get(`/api/posters/${id}`)).status).toBe(404);
    expect((await stranger.agent.get(`/api/posters/${id}/download?size=a3`)).status).toBe(404);
    expect((await stranger.agent.get('/api/posters/me')).body.posters).toHaveLength(0);
    expect((await owner.agent.get('/api/posters/me')).body.posters).toHaveLength(1);
  });

  it('renders A3 on the first download only and redirects to a "save as" link', async () => {
    const { agent, userId } = await login('01712345678');
    const { body } = await agent.post('/api/posters').send(await victoryInput(userId));
    const id = body.poster.id;
    renderCalls.length = 0;

    const first = await agent.get(`/api/posters/${id}/download?size=a3`);
    expect(first.status).toBe(302);
    expect(first.headers.location).toContain('fl_attachment:poster-');
    expect(first.headers.location).toContain('-A3');

    const second = await agent.get(`/api/posters/${id}/download?size=a3`);
    expect(second.headers.location).toBe(first.headers.location);
    expect(renderCalls.map((c) => c.size)).toEqual(['a3']);

    // 4:5 already exists: no render.
    await agent.get(`/api/posters/${id}/download?size=social45`).expect(302);
    expect(renderCalls).toHaveLength(1);
  });
});

describe('POST /api/posters/:id/regenerate', () => {
  it('re-renders with the new text and drops the old A3', async () => {
    const { agent, userId } = await login('01712345678');
    const input = await victoryInput(userId);
    const { body } = await agent.post('/api/posters').send(input);
    const id = body.poster.id;
    await agent.get(`/api/posters/${id}/download?size=a3`).expect(302);
    renderCalls.length = 0;

    const res = await agent
      .post(`/api/posters/${id}/regenerate`)
      .send({ text: { ...input.text, name: 'নতুন নাম' } });

    expect(res.status).toBe(200);
    expect(res.body.poster.editCount).toBe(1);
    expect(res.body.poster.text.name).toBe('নতুন নাম');
    expect(renderCalls[0]!.html.includes('নতুন নাম')).toBe(true);
    const saved = await Poster.findById(id).lean();
    expect(saved!.outputs!.a3).toBeNull();
  });

  it('can swap a photo', async () => {
    const { agent, userId } = await login('01712345678');
    const { body } = await agent.post('/api/posters').send(await victoryInput(userId));
    const newLeader = await upload(userId, 'leader');
    const res = await agent
      .post(`/api/posters/${body.poster.id}/regenerate`)
      .send({ photos: { leader1Photo: newLeader } });
    expect(res.body.poster.photos.leader1Photo.uploadId).toBe(newLeader);
  });
});
