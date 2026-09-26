import { Router } from 'express';
import {
  otpRequestSchema,
  otpVerifySchema,
  type AuthOptionsResponse,
  type MeResponse,
  type OtpRequestResponse,
} from '@app/shared';
import { env, reviewer } from '../config/env';
import { HttpError } from '../lib/httpError';
import { clearSessionCookie, readSessionToken, setSessionCookie } from '../lib/sessionCookie';
import { parseBody } from '../lib/validate';
import { requireAuth } from '../middleware/auth';
import { toAuthUser, User, type UserDoc } from '../models/User';
import {
  consumeCode,
  OTP_TTL_SEC,
  refundAttempt,
  RESEND_AFTER_SEC,
  requestCode,
  verifyCode,
} from '../services/otp';
import { createSession, destroyAllSessions, destroySession } from '../services/session';

export const authRouter = Router();

/** A phone without an account, or whose owner never accepted the terms, is a new user. */
async function isNewUser(phone: string): Promise<boolean> {
  const existing = await User.exists({ phone, acceptedTermsAt: { $ne: null } });
  return !existing;
}

// GET /api/auth/options — what the login screen should offer.
authRouter.get('/options', (_req, res) => {
  const body: AuthOptionsResponse = {
    devMode: env.OTP_DEV_MODE,
    resendAfterSec: RESEND_AFTER_SEC,
    otpTtlSec: OTP_TTL_SEC,
    reviewer,
  };
  res.json(body);
});

// POST /api/auth/otp/request { phone }
// The answer is the same whether or not the phone has an account (no enumeration).
authRouter.post('/otp/request', async (req, res) => {
  const { phone } = parseBody(otpRequestSchema, req.body);
  const { devCode } = await requestCode(phone, req.ip ?? null);

  const body: OtpRequestResponse = {
    resendAfterSec: RESEND_AFTER_SEC,
    expiresInSec: OTP_TTL_SEC,
    ...(devCode ? { devCode } : {}),
  };
  res.json(body);
});

// POST /api/auth/otp/verify { phone, code, acceptTerms? }
authRouter.post('/otp/verify', async (req, res) => {
  const { phone, code, acceptTerms } = parseBody(otpVerifySchema, req.body);

  const checked = await verifyCode(phone, code);

  // Only someone holding a correct code learns that the phone has no account yet. The code stays
  // usable (and the attempt is given back) so the client can resend it with the checkbox ticked.
  const newUser = await isNewUser(phone);
  if (newUser && !acceptTerms) {
    await refundAttempt(checked);
    throw new HttpError(400, 'TERMS_REQUIRED', 'Accept the terms of use to create an account');
  }

  await consumeCode(checked);

  const now = new Date();
  const user = await User.findOneAndUpdate(
    { phone },
    {
      // acceptedTermsAt is only written when it was missing, so later logins keep the date.
      $set: { isVerified: true, lastLoginAt: now, ...(newUser ? { acceptedTermsAt: now } : {}) },
      $setOnInsert: { phone },
    },
    { upsert: true, returnDocument: 'after' },
  ).lean<UserDoc>();
  if (!user) throw new Error('User upsert returned nothing');

  // Always a fresh session on login (no session fixation).
  const session = await createSession(user._id, { userAgent: req.get('user-agent'), ip: req.ip });
  setSessionCookie(res, session.token, session.expiresAt);

  const body: MeResponse = { user: toAuthUser(user) };
  res.json(body);
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, (req, res) => {
  const body: MeResponse = { user: req.auth!.user };
  res.json(body);
});

// POST /api/auth/logout — works without a valid session so the cookie always gets cleared.
authRouter.post('/logout', async (req, res) => {
  await destroySession(readSessionToken(req));
  clearSessionCookie(res);
  res.status(204).end();
});

// POST /api/auth/logout-all — ends every session of this user.
authRouter.post('/logout-all', requireAuth, async (req, res) => {
  await destroyAllSessions(req.auth!.userDoc._id);
  clearSessionCookie(res);
  res.status(204).end();
});
