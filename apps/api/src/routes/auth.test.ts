import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { sha256 } from '../lib/crypto';
import { OtpCode } from '../models/OtpCode';
import { Session } from '../models/Session';
import { User } from '../models/User';
import { useTestDb } from '../../test/db';

useTestDb();

const app = createApp();
const PHONE = '01712345678';
const PHONE_E164 = '+8801712345678';
const ORIGIN = 'http://localhost:3000';

async function requestCode(phone = PHONE) {
  const res = await request(app).post('/api/auth/otp/request').send({ phone });
  expect(res.status).toBe(200);
  return res.body as { isNewUser: boolean; devCode: string; resendAfterSec: number };
}

/** Logs in a new user and returns an agent that carries the session cookie. */
async function login(phone = PHONE) {
  const { devCode } = await requestCode(phone);
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/otp/verify')
    .send({ phone, code: devCode, acceptTerms: true });
  expect(res.status).toBe(200);
  return { agent, res };
}

function sessionCookie(res: request.Response): string | undefined {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  return cookies.find((c) => c.startsWith('sid='));
}

describe('POST /api/auth/otp/request', () => {
  it('rejects numbers that are not Bangladeshi mobiles', async () => {
    for (const phone of ['12345', '01212345678', '+14155550100', '']) {
      const res = await request(app).post('/api/auth/otp/request').send({ phone });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PHONE');
    }
  });

  it('accepts Bangla digits and returns a 6-digit dev code for a new user', async () => {
    const body = await requestCode('০১৭১২৩৪৫৬৭৮');
    expect(body.isNewUser).toBe(true);
    expect(body.devCode).toMatch(/^\d{6}$/);
    expect(body.resendAfterSec).toBe(45);

    const stored = await OtpCode.findOne({ phone: PHONE_E164 }).lean();
    expect(stored?.codeHash).toBeDefined();
    expect(stored?.codeHash).not.toContain(body.devCode);
  });

  it('makes the user wait before requesting another code', async () => {
    await requestCode();
    const res = await request(app).post('/api/auth/otp/request').send({ phone: PHONE });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.body.error.retryAfterSec).toBeGreaterThan(0);
    expect(res.body.error.isNewUser).toBe(true);
  });
});

describe('POST /api/auth/otp/verify', () => {
  it('requires accepting the terms on the first login, without using up an attempt', async () => {
    const { devCode } = await requestCode();
    const res = await request(app)
      .post('/api/auth/otp/verify')
      .send({ phone: PHONE, code: devCode });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TERMS_REQUIRED');

    const otp = await OtpCode.findOne({ phone: PHONE_E164 }).lean();
    expect(otp?.attempts).toBe(0);
  });

  it('logs in: creates the user, sets an httpOnly cookie and stores only the token hash', async () => {
    const { res } = await login();

    expect(res.body.user).toMatchObject({ phone: PHONE_E164, plan: 'free', role: 'user' });
    const cookie = sessionCookie(res)!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    const token = decodeURIComponent(cookie.split(';')[0]!.slice('sid='.length));
    expect(await Session.exists({ tokenHash: sha256(token) })).toBeTruthy();
    expect(await Session.exists({ tokenHash: token })).toBeFalsy();

    const user = await User.findOne({ phone: PHONE_E164 }).lean();
    expect(user?.acceptedTermsAt).toBeInstanceOf(Date);
    // The code is used up.
    expect(await OtpCode.exists({ phone: PHONE_E164 })).toBeFalsy();
  });

  it('does not ask a returning user for the terms again', async () => {
    await login();
    await OtpCode.deleteMany({});
    const { isNewUser, devCode } = await requestCode();
    expect(isNewUser).toBe(false);
    const res = await request(app)
      .post('/api/auth/otp/verify')
      .send({ phone: PHONE, code: devCode });
    expect(res.status).toBe(200);
  });

  it('allows 5 wrong codes, then refuses even the right one', async () => {
    const { devCode } = await requestCode();
    const wrong = devCode === '000000' ? '111111' : '000000';

    for (let left = 4; left >= 0; left--) {
      const res = await request(app)
        .post('/api/auth/otp/verify')
        .send({ phone: PHONE, code: wrong, acceptTerms: true });
      expect(res.body.error).toMatchObject({ code: 'CODE_INVALID', attemptsLeft: left });
    }

    const res = await request(app)
      .post('/api/auth/otp/verify')
      .send({ phone: PHONE, code: devCode, acceptTerms: true });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('TOO_MANY_ATTEMPTS');
  });

  it('never allows more than 5 guesses, even in parallel', async () => {
    const { devCode } = await requestCode();
    const wrong = devCode === '000000' ? '111111' : '000000';

    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        request(app)
          .post('/api/auth/otp/verify')
          .send({ phone: PHONE, code: wrong, acceptTerms: true }),
      ),
    );
    const codes = results.map((r) => r.body.error.code);
    expect(codes.filter((c) => c === 'CODE_INVALID')).toHaveLength(5);
    expect(codes.filter((c) => c === 'TOO_MANY_ATTEMPTS')).toHaveLength(7);
  });

  it('rejects an expired code', async () => {
    const { devCode } = await requestCode();
    await OtpCode.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    const res = await request(app)
      .post('/api/auth/otp/verify')
      .send({ phone: PHONE, code: devCode, acceptTerms: true });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CODE_EXPIRED');
  });

  it('lets reviewers log in with the fixed code, without storing a code', async () => {
    const req = await request(app).post('/api/auth/otp/request').send({ phone: '01999000002' });
    expect(req.body.devCode).toBe('123456');
    expect(await OtpCode.countDocuments()).toBe(0);

    await User.create({ phone: '+8801999000002', plan: 'premium', acceptedTermsAt: new Date() });
    const wrong = await request(app)
      .post('/api/auth/otp/verify')
      .send({ phone: '01999000002', code: '654321' });
    expect(wrong.body.error.code).toBe('CODE_INVALID');

    const ok = await request(app)
      .post('/api/auth/otp/verify')
      .send({ phone: '01999000002', code: '১২৩৪৫৬' });
    expect(ok.status).toBe(200);
    expect(ok.body.user.plan).toBe('premium');
  });
});

describe('sessions', () => {
  it('GET /me needs a session', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('GET /me returns the logged-in user', async () => {
    const { agent } = await login();
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.user.phone).toBe(PHONE_E164);
  });

  it('rejects deleted and expired sessions', async () => {
    const { agent } = await login();
    await Session.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    expect((await agent.get('/api/auth/me')).status).toBe(401);

    const second = await login('01812345678');
    await Session.deleteMany({});
    expect((await second.agent.get('/api/auth/me')).status).toBe(401);
  });

  it('extends a session that was last used over a day ago and re-sends the cookie', async () => {
    const { agent } = await login();
    const before = await Session.findOne().lean();
    await Session.updateMany({}, { lastSeenAt: new Date(Date.now() - 2 * 24 * 3600_000) });

    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(sessionCookie(res)).toBeDefined();
    const after = await Session.findOne().lean();
    expect(after!.expiresAt.getTime()).toBeGreaterThan(before!.expiresAt.getTime());
  });

  it('treats premium as free once planExpiresAt has passed', async () => {
    const { agent } = await login();
    await User.updateMany({}, { plan: 'premium', planExpiresAt: new Date(Date.now() - 1000) });
    expect((await agent.get('/api/auth/me')).body.user.plan).toBe('free');

    await User.updateMany({}, { planExpiresAt: new Date(Date.now() + 3600_000) });
    expect((await agent.get('/api/auth/me')).body.user.plan).toBe('premium');
  });

  it('logout ends the session and clears the cookie', async () => {
    const { agent } = await login();
    const res = await agent.post('/api/auth/logout');
    expect(res.status).toBe(204);
    expect(sessionCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(await Session.countDocuments()).toBe(0);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('logout-all ends every session of the user', async () => {
    const first = await login();
    await OtpCode.deleteMany({});
    const { devCode } = await requestCode();
    const second = request.agent(app);
    await second.post('/api/auth/otp/verify').send({ phone: PHONE, code: devCode });
    expect(await Session.countDocuments()).toBe(2);

    expect((await first.agent.post('/api/auth/logout-all')).status).toBe(204);
    expect(await Session.countDocuments()).toBe(0);
    expect((await second.get('/api/auth/me')).status).toBe(401);
  });
});

describe('origin check', () => {
  it('blocks state-changing requests from other sites', async () => {
    const res = await request(app)
      .post('/api/auth/otp/request')
      .set('Origin', 'https://evil.example')
      .send({ phone: PHONE });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows requests from the app origin', async () => {
    const res = await request(app)
      .post('/api/auth/otp/request')
      .set('Origin', ORIGIN)
      .send({ phone: PHONE });
    expect(res.status).toBe(200);
  });
});

describe('GET /api/auth/options', () => {
  it('lists reviewer access and dev mode', async () => {
    const res = await request(app).get('/api/auth/options');
    expect(res.body).toEqual({
      devMode: true,
      resendAfterSec: 45,
      reviewer: { freePhone: '+8801999000001', premiumPhone: '+8801999000002', code: '123456' },
    });
  });
});
