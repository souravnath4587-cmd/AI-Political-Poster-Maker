import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { sha256 } from '../lib/crypto';
import { HttpError } from '../lib/httpError';
import { OtpCode } from '../models/OtpCode';
import { smsProvider } from '../services/sms';
import { Session } from '../models/Session';
import { User } from '../models/User';
import { useTestDb } from '../../test/db';

useTestDb();
afterEach(() => vi.restoreAllMocks());

const app = createApp();
const PHONE = '01712345678';
const PHONE_E164 = '+8801712345678';
const ORIGIN = 'http://localhost:3000';

async function requestCode(phone = PHONE) {
  const res = await request(app).post('/api/auth/otp/request').send({ phone });
  expect(res.status).toBe(200);
  return res.body as { devCode: string; resendAfterSec: number; expiresInSec: number };
}

/** Moves every stored code back in time, e.g. past the resend cooldown. */
async function ageCodes(ms: number) {
  // Through the driver: Mongoose treats createdAt as immutable.
  const codes = await OtpCode.find().lean();
  for (const code of codes) {
    await OtpCode.collection.updateOne(
      { _id: code._id },
      { $set: { createdAt: new Date(code.createdAt.getTime() - ms) } },
    );
  }
}

/** Stores `count` codes that were sent 10 minutes ago (past the cooldown, inside the hour). */
async function seedSentCodes(count: number, fields: { phone?: string; ip?: string }) {
  const sentAt = new Date(Date.now() - 10 * 60_000);
  await OtpCode.collection.insertMany(
    Array.from({ length: count }, (_, i) => ({
      phone: fields.phone ?? `+88017000000${String(i).padStart(2, '0')}`,
      ip: fields.ip ?? null,
      codeHash: 'x',
      status: 'superseded',
      attempts: 0,
      expiresAt: sentAt,
      purgeAt: new Date(Date.now() + 3600_000),
      createdAt: sentAt,
      updatedAt: sentAt,
    })),
  );
}

const wrongCode = (code: string) => (code === '000000' ? '111111' : '000000');

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

  it('accepts Bangla digits and stores only a hash of the 6-digit code', async () => {
    const body = await requestCode('০১৭১২৩৪৫৬৭৮');
    expect(body.devCode).toMatch(/^\d{6}$/);
    expect(body).toMatchObject({ resendAfterSec: 60, expiresInSec: 180 });

    const stored = await OtpCode.findOne({ phone: PHONE_E164 }).lean();
    expect(stored).toMatchObject({ status: 'pending', attempts: 0, verifiedAt: null });
    expect(stored?.codeHash).not.toContain(body.devCode);
    expect(stored!.expiresAt.getTime() - stored!.createdAt.getTime()).toBeGreaterThanOrEqual(
      179_000,
    );
    expect(stored?.updatedAt).toBeInstanceOf(Date);
  });

  it('answers the same for registered and unknown numbers', async () => {
    await User.create({ phone: '+8801812345678', acceptedTermsAt: new Date() });
    const known = await requestCode('01812345678');
    const unknown = await requestCode();
    expect(Object.keys(known).sort()).toEqual(Object.keys(unknown).sort());
    expect(known).not.toHaveProperty('isNewUser');
  });

  it('sends the code by SMS with its lifetime', async () => {
    const send = vi.spyOn(smsProvider, 'send');
    const { devCode } = await requestCode();
    expect(send).toHaveBeenCalledWith(PHONE_E164, expect.stringContaining(devCode));
    expect(send.mock.calls[0]![1]).toContain('৩ মিনিট');
  });

  it('makes the user wait before requesting another code', async () => {
    await requestCode();
    const res = await request(app).post('/api/auth/otp/request').send({ phone: PHONE });
    expect(res.status).toBe(429);
    expect(res.body.error).toMatchObject({ code: 'RATE_LIMITED', reason: 'cooldown' });
    expect(res.body.error.retryAfterSec).toBeGreaterThan(0);
    expect(res.body.error.retryAfterSec).toBeLessThanOrEqual(60);
    expect(res.body.error).not.toHaveProperty('isNewUser');
  });

  it('sends only one SMS when requests arrive at the same moment', async () => {
    const send = vi.spyOn(smsProvider, 'send');
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        request(app).post('/api/auth/otp/request').send({ phone: PHONE }),
      ),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 429)).toHaveLength(3);
    expect(send).toHaveBeenCalledTimes(1);
    expect(await OtpCode.countDocuments({ status: 'pending' })).toBe(1);
  });

  it('a new code replaces the previous one', async () => {
    const first = await requestCode();
    await ageCodes(61_000);
    const second = await requestCode();
    expect(await OtpCode.countDocuments({ status: 'superseded' })).toBe(1);

    if (first.devCode !== second.devCode) {
      const old = await request(app)
        .post('/api/auth/otp/verify')
        .send({ phone: PHONE, code: first.devCode, acceptTerms: true });
      expect(old.body.error.code).toBe('CODE_INVALID');
    }
    const res = await request(app)
      .post('/api/auth/otp/verify')
      .send({ phone: PHONE, code: second.devCode, acceptTerms: true });
    expect(res.status).toBe(200);
  });

  it('limits codes per phone per hour, counted in the database', async () => {
    await seedSentCodes(5, { phone: PHONE_E164 });
    const res = await request(app).post('/api/auth/otp/request').send({ phone: PHONE });
    expect(res.status).toBe(429);
    expect(res.body.error).toMatchObject({ code: 'RATE_LIMITED', reason: 'hourly' });
    // The oldest code leaves the hour window in about 50 minutes.
    expect(res.body.error.retryAfterSec).toBeGreaterThan(49 * 60);
    expect(res.body.error.retryAfterSec).toBeLessThanOrEqual(50 * 60);
  });

  it('limits codes per IP per hour', async () => {
    await requestCode();
    const { ip } = (await OtpCode.findOne().lean())!;
    await seedSentCodes(19, { ip: ip! });
    const res = await request(app).post('/api/auth/otp/request').send({ phone: '01812345678' });
    expect(res.status).toBe(429);
    expect(res.body.error.reason).toBe('hourly');
  });

  it('reports a failed SMS and lets the user try again at once', async () => {
    vi.spyOn(smsProvider, 'send').mockRejectedValueOnce(
      new HttpError(502, 'SMS_FAILED', 'The SMS could not be sent'),
    );
    const res = await request(app).post('/api/auth/otp/request').send({ phone: PHONE });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('SMS_FAILED');
    expect(res.body.error).not.toHaveProperty('devCode');
    expect((await OtpCode.findOne().lean())?.status).toBe('failed');

    await requestCode();
  });
});

describe('POST /api/auth/otp/verify', () => {
  it('asks a new user for the terms only after a correct code, keeping the code usable', async () => {
    const { devCode } = await requestCode();

    // A wrong code doesn't reveal whether the number has an account.
    const wrong = await request(app)
      .post('/api/auth/otp/verify')
      .send({ phone: PHONE, code: wrongCode(devCode) });
    expect(wrong.body.error.code).toBe('CODE_INVALID');

    const res = await request(app)
      .post('/api/auth/otp/verify')
      .send({ phone: PHONE, code: devCode });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TERMS_REQUIRED');
    // Only the wrong guess counts; the correct one was given back.
    const otp = await OtpCode.findOne({ phone: PHONE_E164 }).lean();
    expect(otp).toMatchObject({ status: 'pending', attempts: 1 });

    const ok = await request(app)
      .post('/api/auth/otp/verify')
      .send({ phone: PHONE, code: devCode, acceptTerms: true });
    expect(ok.status).toBe(200);
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
    // The code is marked as used.
    const otp = await OtpCode.findOne({ phone: PHONE_E164 }).lean();
    expect(otp?.status).toBe('verified');
    expect(otp?.verifiedAt).toBeInstanceOf(Date);
  });

  it('never accepts a used code again', async () => {
    const { devCode } = await requestCode();
    const verify = () =>
      request(app)
        .post('/api/auth/otp/verify')
        .send({ phone: PHONE, code: devCode, acceptTerms: true });

    const results = await Promise.all([verify(), verify(), verify()]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect((await verify()).body.error.code).toBe('CODE_EXPIRED');
    expect(await Session.countDocuments()).toBe(1);
  });

  it('does not ask a returning user for the terms again', async () => {
    await login();
    await OtpCode.deleteMany({});
    const { devCode } = await requestCode();
    const res = await request(app)
      .post('/api/auth/otp/verify')
      .send({ phone: PHONE, code: devCode });
    expect(res.status).toBe(200);
  });

  it('allows 5 wrong codes, then refuses even the right one', async () => {
    const { devCode } = await requestCode();
    const wrong = wrongCode(devCode);

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
    const wrong = wrongCode(devCode);

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
      resendAfterSec: 60,
      otpTtlSec: 180,
      reviewer: { freePhone: '+8801999000001', premiumPhone: '+8801999000002', code: '123456' },
    });
  });
});
