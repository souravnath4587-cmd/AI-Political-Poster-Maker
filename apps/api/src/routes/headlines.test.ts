import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dhakaDate } from '@app/shared';
import { useTestDb } from '../../test/db';

// Gemini is faked: each test decides what it answers.
const generateJson = vi.fn();
vi.mock('../services/gemini', () => ({
  geminiConfigured: () => true,
  generateJson: (...args: unknown[]) => generateJson(...args),
}));

const { createApp } = await import('../app');
const { cleanHeadlines } = await import('../services/headlines');
const { GenerationLog } = await import('../models/GenerationLog');
const { Template } = await import('../models/Template');
const { UsageCounter } = await import('../models/UsageCounter');
const { TEMPLATE_SEEDS } = await import('../templates');

useTestDb();
const app = createApp();
let templateId: string;

beforeEach(async () => {
  generateJson.mockReset();
  const t = await Template.create({ ...TEMPLATE_SEEDS[0]!, thumbnailUrl: '/t.webp' });
  templateId = t._id.toString();
});

async function login() {
  const phone = '01712345678';
  const { body } = await request(app).post('/api/auth/otp/request').send({ phone });
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/otp/verify')
    .send({ phone, code: body.devCode, acceptTerms: true })
    .expect(200);
  return { agent, userId: res.body.user.id as string };
}

describe('cleanHeadlines', () => {
  it('keeps short Bangla headlines and drops the rest', () => {
    expect(
      cleanHeadlines([
        '“মহান বিজয় দিবস”',
        '1. বিজয়ের গৌরবে উদ্ভাসিত কুমিল্লা',
        'Victory Day বিজয়', // English
        'ক'.repeat(61), // too long
        'মহান বিজয় দিবস', // duplicate after cleaning
        '   ',
        'শহীদের রক্তে গড়া বিজয়',
      ]),
    ).toEqual(['মহান বিজয় দিবস', 'বিজয়ের গৌরবে উদ্ভাসিত কুমিল্লা', 'শহীদের রক্তে গড়া বিজয়']);
  });

  it('returns at most 5', () => {
    expect(cleanHeadlines(['এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়'])).toHaveLength(5);
  });
});

describe('POST /api/headlines/suggest', () => {
  it('requires a session and a known template', async () => {
    expect((await request(app).post('/api/headlines/suggest').send({ templateId })).status).toBe(
      401,
    );
    const { agent } = await login();
    const res = await agent
      .post('/api/headlines/suggest')
      .send({ templateId: '0123456789abcdef01234567' });
    expect(res.body.error.code).toBe('TEMPLATE_NOT_FOUND');
  });

  it('returns cleaned suggestions, uses one unit of quota and logs the call', async () => {
    generateJson.mockResolvedValue({
      data: {
        headlines: ['বিজয়ের গৌরবে কুমিল্লা', '“চেতনায় অম্লান বিজয়”', 'Happy Victory Day'],
      },
      model: 'gemini-3.1-flash-lite',
      latencyMs: 1200,
    });
    const { agent, userId } = await login();

    const res = await agent
      .post('/api/headlines/suggest')
      .send({ templateId, context: { organization: 'যুব সংগঠন', location: 'কুমিল্লা' } });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      suggestions: ['বিজয়ের গৌরবে কুমিল্লা', 'চেতনায় অম্লান বিজয়'],
      remaining: 19,
    });
    const prompt = generateJson.mock.calls[0]![0].contents[0].text as string;
    expect(prompt).toContain('বিজয় দিবস');
    expect(prompt).toContain('কুমিল্লা');
    expect(await GenerationLog.findOne({ userId, stage: 'headline' }).lean()).toMatchObject({
      success: true,
      model: 'gemini-3.1-flash-lite',
    });
  });

  it('answers 503 and gives the quota back when Gemini fails or returns nothing usable', async () => {
    const { agent, userId } = await login();

    generateJson.mockRejectedValueOnce(Object.assign(new Error('503 UNAVAILABLE'), { model: 'x' }));
    const busy = await agent.post('/api/headlines/suggest').send({ templateId });
    expect(busy.status).toBe(503);
    expect(busy.body.error.code).toBe('AI_UNAVAILABLE');

    generateJson.mockResolvedValueOnce({
      data: { headlines: ['English only'] },
      model: 'x',
      latencyMs: 1,
    });
    const empty = await agent.post('/api/headlines/suggest').send({ templateId });
    expect(empty.body.error.code).toBe('AI_UNAVAILABLE');

    const row = await UsageCounter.findOne({ userId, date: dhakaDate() }).lean();
    expect(row?.headlines ?? 0).toBe(0);
    expect(await GenerationLog.countDocuments({ userId, stage: 'headline', success: false })).toBe(
      2,
    );
  });

  it('allows 20 suggestion requests a day', async () => {
    const { agent, userId } = await login();
    await UsageCounter.create({ userId, date: dhakaDate(), headlines: 20 });
    const res = await agent.post('/api/headlines/suggest').send({ templateId });
    expect(res.status).toBe(429);
    expect(res.body.error).toMatchObject({ code: 'QUOTA_EXCEEDED', kind: 'headlines', limit: 20 });
    expect(generateJson).not.toHaveBeenCalled();
  });

  it('works for counters created before the headline limit existed', async () => {
    generateJson.mockResolvedValue({
      data: { headlines: ['মহান বিজয় দিবস'] },
      model: 'x',
      latencyMs: 1,
    });
    const { agent, userId } = await login();
    // A row from earlier today without a `headlines` field.
    await UsageCounter.collection.insertOne({
      userId: new (await import('mongoose')).Types.ObjectId(userId),
      date: dhakaDate(),
      posters: 1,
      regenerations: 0,
    });
    const res = await agent.post('/api/headlines/suggest').send({ templateId });
    expect(res.status).toBe(200);
    expect(res.body.remaining).toBe(19);
  });
});
