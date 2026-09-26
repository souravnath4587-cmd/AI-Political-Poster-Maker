import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDb } from '../../test/db';

// Limits are off in the other test files; this one checks them.
process.env.RATE_LIMITS_ENABLED = 'true';

vi.mock('../services/gemini', () => ({
  geminiConfigured: () => true,
  generateJson: async () => ({
    data: { headlines: ['মহান বিজয় দিবস'] },
    model: 'x',
    latencyMs: 1,
  }),
}));

const { createApp } = await import('../app');
const { Template } = await import('../models/Template');
const { TEMPLATE_SEEDS } = await import('../templates');

useTestDb();

describe('rate limits', () => {
  it('allows 5 code requests per hour per phone, then answers 429 with a wait time', async () => {
    const app = createApp();
    const phone = '01712345678';
    // The stored limits (cooldown, codes per hour) are separate; clearing codes resets them.
    const { OtpCode } = await import('../models/OtpCode');
    for (let i = 0; i < 5; i++) {
      await OtpCode.deleteMany({});
      await request(app).post('/api/auth/otp/request').send({ phone }).expect(200);
    }
    await OtpCode.deleteMany({});
    const res = await request(app).post('/api/auth/otp/request').send({ phone });
    expect(res.status).toBe(429);
    expect(res.body.error).toMatchObject({ code: 'RATE_LIMITED', scope: 'otp-request' });
    expect(res.body.error.retryAfterSec).toBeGreaterThan(0);
    expect(res.headers['ratelimit-policy'] ?? res.headers.ratelimit).toBeDefined();
  });

  it('does not limit the shared reviewer numbers per phone', async () => {
    const app = createApp();
    for (let i = 0; i < 8; i++) {
      await request(app).post('/api/auth/otp/request').send({ phone: '01999000001' }).expect(200);
    }
  });

  describe('per session', () => {
    let templateId: string;
    beforeAll(async () => {
      templateId = (
        await Template.create({ ...TEMPLATE_SEEDS[0]!, thumbnailUrl: '/t.webp' })
      )._id.toString();
    });

    it('allows 10 headline suggestions a minute', async () => {
      const app = createApp();
      const agent = request.agent(app);
      await agent.post('/api/auth/otp/request').send({ phone: '01999000001' });
      await agent
        .post('/api/auth/otp/verify')
        .send({ phone: '01999000001', code: '123456', acceptTerms: true })
        .expect(200);

      for (let i = 0; i < 10; i++) {
        await agent.post('/api/headlines/suggest').send({ templateId }).expect(200);
      }
      const res = await agent.post('/api/headlines/suggest').send({ templateId });
      expect(res.status).toBe(429);
      expect(res.body.error).toMatchObject({ code: 'RATE_LIMITED', scope: 'headlines' });
    });
  });
});
