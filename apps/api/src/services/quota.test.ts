import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../test/db';
import { HttpError } from '../lib/httpError';
import { UsageCounter } from '../models/UsageCounter';
import { User, type UserDoc } from '../models/User';
import { getQuota, refundQuota, reserveQuota } from './quota';

useTestDb();

let phoneSeq = 0;
async function makeUser(fields: Partial<UserDoc> = {}): Promise<UserDoc> {
  const user = await User.create({
    phone: `+88017000000${String(phoneSeq++).padStart(2, '0')}`,
    ...fields,
  });
  return user.toObject() as UserDoc;
}

/** Tries n reservations at once; returns how many succeeded and how many hit the limit. */
async function parallel(user: UserDoc, n: number, kind: 'posters' | 'regenerations' = 'posters') {
  const results = await Promise.allSettled(
    Array.from({ length: n }, () => reserveQuota(user, kind)),
  );
  const exceeded = results.filter(
    (r) =>
      r.status === 'rejected' &&
      r.reason instanceof HttpError &&
      r.reason.code === 'QUOTA_EXCEEDED',
  ).length;
  const other = results.filter((r) => r.status === 'rejected').length - exceeded;
  return { ok: results.filter((r) => r.status === 'fulfilled').length, exceeded, other };
}

describe('reserveQuota', () => {
  it('allows a free user 3 posters and 2 regenerations a day', async () => {
    const user = await makeUser();
    for (let i = 0; i < 3; i++) await reserveQuota(user, 'posters');
    await expect(reserveQuota(user, 'posters')).rejects.toMatchObject({
      status: 429,
      code: 'QUOTA_EXCEEDED',
      details: { kind: 'posters', limit: 3 },
    });

    await reserveQuota(user, 'regenerations');
    await reserveQuota(user, 'regenerations');
    await expect(reserveQuota(user, 'regenerations')).rejects.toMatchObject({
      code: 'QUOTA_EXCEEDED',
    });
  });

  it('allows pro users 10 + 5, and treats expired pro as free', async () => {
    const pro = await makeUser({ plan: 'pro' });
    expect((await parallel(pro, 12)).ok).toBe(10);
    expect((await parallel(pro, 7, 'regenerations')).ok).toBe(5);

    const expired = await makeUser({ plan: 'pro', planExpiresAt: new Date(Date.now() - 1000) });
    expect((await parallel(expired, 5)).ok).toBe(3);
  });

  it('never limits premium users but still counts, and treats expired premium as free', async () => {
    const premium = await makeUser({ plan: 'premium' });
    expect((await parallel(premium, 25)).ok).toBe(25);
    expect((await parallel(premium, 8, 'regenerations')).ok).toBe(8);

    const quota = await getQuota(premium);
    expect(quota.plan).toBe('premium');
    expect(quota.posters).toEqual({ used: 25, limit: null, remaining: null });
    expect(quota.regenerations).toEqual({ used: 8, limit: null, remaining: null });

    const expired = await makeUser({
      plan: 'premium',
      planExpiresAt: new Date(Date.now() - 1000),
    });
    expect((await parallel(expired, 5)).ok).toBe(3);
  });

  it('never exceeds the limit with 5 parallel requests at the edge', async () => {
    const user = await makeUser();
    await reserveQuota(user, 'posters');
    await reserveQuota(user, 'posters');

    expect(await parallel(user, 5)).toEqual({ ok: 1, exceeded: 4, other: 0 });
    const row = await UsageCounter.findOne({ userId: user._id }).lean();
    expect(row?.posters).toBe(3);
  });

  it('counts correctly when the first requests of the day arrive together', async () => {
    const user = await makeUser();
    expect(await parallel(user, 6)).toEqual({ ok: 3, exceeded: 3, other: 0 });
    expect(await UsageCounter.countDocuments({ userId: user._id })).toBe(1);
  });

  it('starts fresh on a new Dhaka day (18:00 UTC)', async () => {
    const user = await makeUser();
    const beforeMidnight = new Date('2026-09-25T17:59:00Z');
    const afterMidnight = new Date('2026-09-25T18:00:00Z');
    for (let i = 0; i < 3; i++) await reserveQuota(user, 'posters', beforeMidnight);
    await expect(reserveQuota(user, 'posters', beforeMidnight)).rejects.toMatchObject({
      code: 'QUOTA_EXCEEDED',
      details: { resetsAt: '2026-09-25T18:00:00.000Z' },
    });

    const next = await reserveQuota(user, 'posters', afterMidnight);
    expect(next.date).toBe('2026-09-26');
  });
});

describe('refundQuota', () => {
  it('gives the unit back, but never below zero', async () => {
    const user = await makeUser();
    const reservation = await reserveQuota(user, 'posters');
    await refundQuota(reservation);
    await refundQuota(reservation);
    const row = await UsageCounter.findOne({ userId: user._id }).lean();
    expect(row?.posters).toBe(0);
  });
});

describe('getQuota', () => {
  it('reports used, limit and remaining for today', async () => {
    const user = await makeUser();
    await reserveQuota(user, 'posters');
    const quota = await getQuota(user);
    expect(quota).toMatchObject({
      plan: 'free',
      posters: { used: 1, limit: 3, remaining: 2 },
      regenerations: { used: 0, limit: 2, remaining: 2 },
    });
  });
});
