import type { Types } from 'mongoose';
import {
  dhakaDate,
  nextDhakaMidnight,
  QUOTA_LIMITS,
  type QuotaDto,
  type QuotaKind,
} from '@app/shared';
import { HttpError } from '../lib/httpError';
import { UsageCounter } from '../models/UsageCounter';
import { effectivePlan, type UserDoc } from '../models/User';

/** What reserve() took, so refund() gives back exactly that (even if the day changed since). */
export interface QuotaReservation {
  userId: Types.ObjectId;
  date: string;
  kind: QuotaKind;
}

const isDuplicateKey = (err: unknown) => (err as { code?: number })?.code === 11000;

/** Makes sure today's row exists. Parallel first requests may race; losing that race is fine. */
async function ensureCounter(userId: Types.ObjectId, date: string): Promise<void> {
  try {
    await UsageCounter.updateOne(
      { userId, date },
      { $setOnInsert: { posters: 0, regenerations: 0, headlines: 0 } },
      { upsert: true },
    );
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
  }
}

/**
 * Takes one unit of today's quota, or throws 429 QUOTA_EXCEEDED.
 * The check and the increment are one conditional update ($lt then $inc), so parallel requests
 * can never go over the limit.
 */
export async function reserveQuota(
  user: UserDoc,
  kind: QuotaKind,
  now: Date = new Date(),
): Promise<QuotaReservation> {
  const date = dhakaDate(now);
  const limit = QUOTA_LIMITS[effectivePlan(user, now)][kind];
  await ensureCounter(user._id, date);

  // Unlimited: still counted (for refunds and stats), never refused.
  if (limit === null) {
    await UsageCounter.updateOne({ userId: user._id, date }, { $inc: { [kind]: 1 } });
    return { userId: user._id, date, kind };
  }

  const updated = await UsageCounter.findOneAndUpdate(
    // "Not >= limit" also matches rows created before this counter existed (field missing).
    { userId: user._id, date, [kind]: { $not: { $gte: limit } } },
    { $inc: { [kind]: 1 } },
    { returnDocument: 'after' },
  ).lean();

  if (!updated) {
    throw new HttpError(429, 'QUOTA_EXCEEDED', `Daily ${kind} limit reached`, {
      kind,
      limit,
      resetsAt: nextDhakaMidnight(now).toISOString(),
    });
  }
  return { userId: user._id, date, kind };
}

/** Gives back a reservation (the render or upload failed, so it shouldn't count). */
export async function refundQuota({ userId, date, kind }: QuotaReservation): Promise<void> {
  await UsageCounter.updateOne({ userId, date, [kind]: { $gt: 0 } }, { $inc: { [kind]: -1 } });
}

/** Runs `work` with one unit of quota; refunds it if `work` throws. */
export async function withQuota<T>(
  user: UserDoc,
  kind: QuotaKind,
  work: () => Promise<T>,
): Promise<T> {
  const reservation = await reserveQuota(user, kind);
  try {
    return await work();
  } catch (err) {
    await refundQuota(reservation);
    throw err;
  }
}

export async function getQuota(user: UserDoc, now: Date = new Date()): Promise<QuotaDto> {
  const date = dhakaDate(now);
  const plan = effectivePlan(user, now);
  const limits = QUOTA_LIMITS[plan];
  const row = await UsageCounter.findOne({ userId: user._id, date }).lean();

  const count = (kind: QuotaKind) => {
    const used = row?.[kind] ?? 0;
    const limit = limits[kind];
    return { used, limit, remaining: limit === null ? null : Math.max(0, limit - used) };
  };

  return {
    plan,
    date,
    posters: count('posters'),
    regenerations: count('regenerations'),
    headlines: count('headlines'),
    resetsAt: nextDhakaMidnight(now).toISOString(),
  };
}
