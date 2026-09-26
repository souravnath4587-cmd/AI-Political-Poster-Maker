import type { UserPlan } from './auth';

export type QuotaKind = 'posters' | 'regenerations' | 'headlines';

/**
 * Daily limits per plan (project-scope §12). Headline suggestions have their own limit on both
 * plans, only to cap Gemini cost.
 */
export const QUOTA_LIMITS: Record<UserPlan, Record<QuotaKind, number | null>> = {
  free: { posters: 3, regenerations: 2, headlines: 20 },
  pro: { posters: 10, regenerations: 5, headlines: 20 },
  // null = unlimited (still counted, never blocked). The per-minute abuse limits still apply.
  premium: { posters: null, regenerations: null, headlines: null },
};

/** Monthly price per plan in BDT. Shown on the plans page; payments aren't built yet. */
export const PLAN_PRICE_BDT: Record<UserPlan, number> = { free: 0, pro: 100, premium: 150 };

/** Bangladesh has no daylight saving time: always UTC+6. */
export const DHAKA_UTC_OFFSET_MS = 6 * 60 * 60 * 1000;

/** The calendar day in Dhaka as YYYY-MM-DD (quotas reset at Dhaka midnight, not UTC midnight). */
export function dhakaDate(now: Date = new Date()): string {
  return new Date(now.getTime() + DHAKA_UTC_OFFSET_MS).toISOString().slice(0, 10);
}

/** The next 00:00 in Dhaka, as an instant. */
export function nextDhakaMidnight(now: Date = new Date()): Date {
  const [year, month, day] = dhakaDate(now).split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day + 1) - DHAKA_UTC_OFFSET_MS);
}

export interface QuotaCount {
  used: number;
  /** null = unlimited. */
  limit: number | null;
  remaining: number | null;
}

export interface QuotaDto {
  plan: UserPlan;
  /** Dhaka date the counts belong to. */
  date: string;
  posters: QuotaCount;
  regenerations: QuotaCount;
  headlines: QuotaCount;
  /** ISO time of the next reset (Dhaka midnight). */
  resetsAt: string;
}

export interface QuotaResponse {
  quota: QuotaDto;
}
