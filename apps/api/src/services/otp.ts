import { randomInt } from 'node:crypto';
import { OTP_LENGTH } from '@app/shared';
import { env, otpPepper, reviewer } from '../config/env';
import { safeEqual, sha256 } from '../lib/crypto';
import { HttpError } from '../lib/httpError';
import { OtpCode } from '../models/OtpCode';
import { smsProvider } from './sms';

export const OTP_TTL_MS = 5 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
export const RESEND_AFTER_SEC = 45;

const hashCode = (phone: string, code: string) => sha256(`${otpPepper}:${phone}:${code}`);

export function isReviewerPhone(phone: string): boolean {
  return reviewer !== null && (phone === reviewer.freePhone || phone === reviewer.premiumPhone);
}

/** Creates a new code for the phone (replacing any old one) and sends it by SMS. */
export async function requestCode(phone: string): Promise<{ devCode?: string }> {
  // Reviewer numbers use the fixed code: nothing to store or send.
  if (isReviewerPhone(phone)) return env.OTP_DEV_MODE ? { devCode: reviewer!.code } : {};

  const recent = await OtpCode.findOne({
    phone,
    createdAt: { $gt: new Date(Date.now() - RESEND_AFTER_SEC * 1000) },
  }).lean();
  if (recent) {
    const retryAfterSec = Math.ceil(
      (recent.createdAt.getTime() + RESEND_AFTER_SEC * 1000 - Date.now()) / 1000,
    );
    throw new HttpError(429, 'RATE_LIMITED', 'Wait before requesting another code', {
      retryAfterSec,
    });
  }

  const code = String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
  await OtpCode.deleteMany({ phone });
  await OtpCode.create({
    phone,
    codeHash: hashCode(phone, code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  await smsProvider.send(
    phone,
    `পোস্টার মেকার: আপনার লগইন কোড ${code}। কোডটি ৫ মিনিট কার্যকর থাকবে।`,
  );
  return env.OTP_DEV_MODE ? { devCode: code } : {};
}

/**
 * Checks a code; it's used up on success.
 * Throws CODE_INVALID (with attemptsLeft), CODE_EXPIRED or TOO_MANY_ATTEMPTS.
 */
export async function verifyCode(phone: string, code: string): Promise<void> {
  if (isReviewerPhone(phone)) {
    if (!safeEqual(code, reviewer!.code)) throw new HttpError(400, 'CODE_INVALID', 'Wrong code');
    return;
  }

  const now = new Date();
  // Count the attempt in the same update that finds the code, so parallel guesses can't
  // get more than OTP_MAX_ATTEMPTS tries.
  const otp = await OtpCode.findOneAndUpdate(
    { phone, expiresAt: { $gt: now }, attempts: { $lt: OTP_MAX_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after' },
  ).lean();

  if (!otp) {
    const exhausted = await OtpCode.exists({ phone, expiresAt: { $gt: now } });
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

  await OtpCode.deleteOne({ _id: otp._id });
}
