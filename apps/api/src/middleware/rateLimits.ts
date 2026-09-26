import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { normalizeBdPhone } from '@app/shared';
import { env } from '../config/env';
import { sha256 } from '../lib/crypto';
import { HttpError } from '../lib/httpError';
import { readSessionToken } from '../lib/sessionCookie';
import { isReviewerPhone } from '../services/otp';

const MINUTE = 60_000;

const byIp = (req: Request) => ipKeyGenerator(req.ip ?? '');

/** Per session when logged in (the cookie's hash), else per IP. */
const bySession = (req: Request) => {
  const token = readSessionToken(req);
  return token ? `sid:${sha256(token)}` : byIp(req);
};

function phoneOf(req: Request): string | null {
  const raw: unknown = req.body?.phone;
  return typeof raw === 'string' ? normalizeBdPhone(raw) : null;
}

function limiter(
  scope: string,
  options: {
    windowMs: number;
    limit: number;
    key: (req: Request) => string;
    skip?: (req: Request) => boolean;
  },
): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: options.key,
    skip: (req) => !env.RATE_LIMITS_ENABLED || (options.skip?.(req) ?? false),
    handler: (req, _res, next) => {
      // express-rate-limit sets req.rateLimit (its type augmentation isn't visible under pnpm).
      const info = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit;
      const resetAt = info?.resetTime?.getTime() ?? Date.now() + options.windowMs;
      next(
        new HttpError(429, 'RATE_LIMITED', 'Too many requests', {
          scope,
          retryAfterSec: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
        }),
      );
    },
  });
}

const writesOnly = (req: Request) => req.method === 'GET' || req.method === 'HEAD';

/**
 * In-memory limits: a cheap first layer, counted per API instance. The one-time-code limits
 * that must hold across instances (cooldown, codes per phone / IP per hour, wrong guesses per
 * code) are also enforced in services/otp.ts, from MongoDB. Created per app so each test app
 * starts with fresh counters. Daily quotas (Phase 6) are separate: these stop bursts and guessing.
 */
export function createRateLimits() {
  return {
    otpRequest: [
      limiter('otp-request', { windowMs: 60 * MINUTE, limit: 20, key: byIp }),
      // Reviewer numbers never send SMS and are shared by reviewers: not limited per phone.
      limiter('otp-request', {
        windowMs: 60 * MINUTE,
        limit: 5,
        key: (req) => `phone:${phoneOf(req) ?? byIp(req)}`,
        skip: (req) => {
          const phone = phoneOf(req);
          return phone !== null && isReviewerPhone(phone);
        },
      }),
    ],
    otpVerify: limiter('otp-verify', { windowMs: 15 * MINUTE, limit: 30, key: byIp }),
    upload: limiter('upload', { windowMs: 10 * MINUTE, limit: 40, key: bySession }),
    posterWrites: limiter('posters', {
      windowMs: 10 * MINUTE,
      limit: 30,
      key: bySession,
      skip: writesOnly,
    }),
    headlines: limiter('headlines', { windowMs: MINUTE, limit: 10, key: bySession }),
    // Starting a bKash payment; the callback and history are GETs and not limited here.
    payments: limiter('payments', {
      windowMs: 10 * MINUTE,
      limit: 10,
      key: bySession,
      skip: writesOnly,
    }),
  };
}
