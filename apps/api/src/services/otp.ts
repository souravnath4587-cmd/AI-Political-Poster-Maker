import { randomInt } from 'node:crypto';
import type { Types } from 'mongoose';
import { OTP_LENGTH, toBanglaDigits } from '@app/shared';
import { env, otpPepper, reviewer } from '../config/env';
import { safeEqual, sha256 } from '../lib/crypto';
import { HttpError } from '../lib/httpError';
import { OTP_RETENTION_MS, OtpCode } from '../models/OtpCode';
import { smsProvider } from './sms';

export const OTP_TTL_SEC = env.OTP_TTL_SEC;
export const OTP_MAX_ATTEMPTS = env.OTP_MAX_ATTEMPTS;
export const RESEND_AFTER_SEC = env.OTP_RESEND_COOLDOWN_SEC;

const HOUR_MS = 60 * 60_000;
/** Codes whose SMS never went out don't count towards the cooldown or the hourly limits. */
const SENT = { status: { $ne: 'failed' } } as const;

const hashCode = (phone: string, code: string) => sha256(`${otpPepper}:${phone}:${code}`);

const secondsUntil = (time: number) => Math.max(1, Math.ceil((time - Date.now()) / 1000));

/** "৩ মিনিট", or "৯০ সেকেন্ড" when the lifetime isn't whole minutes. */
function lifetimeText(sec: number): string {
  return sec % 60 === 0 ? `${toBanglaDigits(sec / 60)} মিনিট` : `${toBanglaDigits(sec)} সেকেন্ড`;
}

export function isReviewerPhone(phone: string): boolean {
  return reviewer !== null && (phone === reviewer.freePhone || phone === reviewer.premiumPhone);
}

function cooldownError(retryAfterSec: number): HttpError {
  // `reason: 'cooldown'` tells the client the previous code is still usable.
  return new HttpError(429, 'RATE_LIMITED', 'Wait before requesting another code', {
    scope: 'otp-request',
    reason: 'cooldown',
    retryAfterSec,
  });
}

/** 429 when `filter` already has `limit` sent codes in the last hour (stored, so it holds across instances). */
async function checkHourlyLimit(filter: { phone: string } | { ip: string }, limit: number) {
  const since = new Date(Date.now() - HOUR_MS);
  const recent = { ...filter, ...SENT, createdAt: { $gt: since } };
  if ((await OtpCode.countDocuments(recent)) < limit) return;

  const oldest = await OtpCode.findOne(recent).sort({ createdAt: 1 }).select('createdAt').lean();
  throw new HttpError(429, 'RATE_LIMITED', 'Too many codes requested', {
    scope: 'otp-request',
    reason: 'hourly',
    retryAfterSec: secondsUntil((oldest?.createdAt.getTime() ?? Date.now()) + HOUR_MS),
  });
}

/**
 * Creates a new code for the phone and sends it by SMS; older codes stop working once it's sent.
 * Throws RATE_LIMITED (cooldown or hourly limit), SMS_FAILED or SMS_UNAVAILABLE.
 */
export async function requestCode(phone: string, ip: string | null): Promise<{ devCode?: string }> {
  // Reviewer numbers use the fixed code: nothing to store or send.
  if (isReviewerPhone(phone)) return env.OTP_DEV_MODE ? { devCode: reviewer!.code } : {};

  const cooldownMs = RESEND_AFTER_SEC * 1000;
  const latest = await OtpCode.findOne({ phone, ...SENT })
    .sort({ createdAt: -1 })
    .select('createdAt')
    .lean();
  if (latest && latest.createdAt.getTime() > Date.now() - cooldownMs) {
    throw cooldownError(secondsUntil(latest.createdAt.getTime() + cooldownMs));
  }
  await checkHourlyLimit({ phone }, env.OTP_MAX_PER_PHONE_PER_HOUR);
  if (ip) await checkHourlyLimit({ ip }, env.OTP_MAX_PER_IP_PER_HOUR);

  const code = String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
  const now = Date.now();
  const otp = await OtpCode.create({
    phone,
    codeHash: hashCode(phone, code),
    expiresAt: new Date(now + OTP_TTL_SEC * 1000),
    purgeAt: new Date(now + OTP_RETENTION_MS),
    ip,
  });

  // Two requests at the same moment can both pass the cooldown check: only the one with the
  // lower id sends an SMS.
  const rival = await OtpCode.exists({
    phone,
    ...SENT,
    _id: { $lt: otp._id },
    createdAt: { $gt: new Date(now - cooldownMs) },
  });
  if (rival) {
    await OtpCode.deleteOne({ _id: otp._id });
    throw cooldownError(RESEND_AFTER_SEC);
  }

  try {
    await smsProvider.send(
      phone,
      `পোস্টার মেকার: আপনার লগইন কোড ${code}। কোডটি ${lifetimeText(OTP_TTL_SEC)} কার্যকর থাকবে। কাউকে জানাবেন না।`,
    );
  } catch (err) {
    await OtpCode.updateOne({ _id: otp._id }, { status: 'failed' });
    throw err;
  }

  await OtpCode.updateMany(
    { phone, status: 'pending', _id: { $ne: otp._id } },
    { status: 'superseded' },
  );
  return env.OTP_DEV_MODE ? { devCode: code } : {};
}

/** A correct code that hasn't been used yet (`id` is null for reviewer numbers). */
export interface CheckedCode {
  id: Types.ObjectId | null;
}

/**
 * Checks a code against the phone's latest pending code, counting the attempt. The code stays
 * usable until consumeCode. Throws CODE_INVALID (with attemptsLeft), CODE_EXPIRED or
 * TOO_MANY_ATTEMPTS; the answers are the same whether or not the phone has an account.
 */
export async function verifyCode(phone: string, code: string): Promise<CheckedCode> {
  if (isReviewerPhone(phone)) {
    if (!safeEqual(code, reviewer!.code)) throw new HttpError(400, 'CODE_INVALID', 'Wrong code');
    return { id: null };
  }

  const now = new Date();
  // Count the attempt in the same update that finds the code, so parallel guesses can't
  // get more than OTP_MAX_ATTEMPTS tries.
  const otp = await OtpCode.findOneAndUpdate(
    { phone, status: 'pending', expiresAt: { $gt: now }, attempts: { $lt: OTP_MAX_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { sort: { createdAt: -1 }, returnDocument: 'after' },
  ).lean();

  if (!otp) {
    const exhausted = await OtpCode.exists({ phone, status: 'pending', expiresAt: { $gt: now } });
    if (exhausted) {
      throw new HttpError(429, 'TOO_MANY_ATTEMPTS', 'Too many wrong codes; request a new one');
    }
    throw new HttpError(400, 'CODE_EXPIRED', 'No active code; request a new one');
  }

  if (!safeEqual(otp.codeHash, hashCode(phone, code))) {
    throw new HttpError(400, 'CODE_INVALID', 'Wrong code', {
      attemptsLeft: OTP_MAX_ATTEMPTS - otp.attempts,
    });
  }
  return { id: otp._id };
}

/** Gives back the attempt a correct code used (when the login stops for another reason). */
export async function refundAttempt({ id }: CheckedCode): Promise<void> {
  if (id) await OtpCode.updateOne({ _id: id, attempts: { $gt: 0 } }, { $inc: { attempts: -1 } });
}

/** Marks the code as used; a code can only be used once, even by parallel requests. */
export async function consumeCode({ id }: CheckedCode): Promise<void> {
  if (!id) return;
  const { modifiedCount } = await OtpCode.updateOne(
    { _id: id, status: 'pending' },
    { status: 'verified', verifiedAt: new Date() },
  );
  if (modifiedCount === 0) {
    throw new HttpError(400, 'CODE_EXPIRED', 'No active code; request a new one');
  }
}
