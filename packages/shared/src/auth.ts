import { z } from 'zod';

// ---------------------------------------------------------------------------
// Phone numbers and codes
// ---------------------------------------------------------------------------

const BANGLA_DIGITS = '০১২৩৪৫৬৭৮৯';

/** Converts Bangla digits (০-৯) to ASCII digits; other characters are kept. */
export function toAsciiDigits(value: string): string {
  return value.replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)));
}

/** Converts ASCII digits to Bangla digits, for showing numbers in the UI. */
export function toBanglaDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => BANGLA_DIGITS[Number(d)]!);
}

/**
 * Normalizes a Bangladeshi mobile number to E.164 (`+8801XXXXXXXXX`), or returns null.
 * Accepts Bangla or ASCII digits, spaces and dashes, and the +880 / 880 / 0 prefixes.
 */
export function normalizeBdPhone(input: string): string | null {
  const digits = toAsciiDigits(input).replace(/[\s\-()]/g, '');
  const local = digits.replace(/^(?:\+?880|0)/, '');
  return /^1[3-9]\d{8}$/.test(local) ? `+880${local}` : null;
}

/** `+8801712345678` → `01712345678` (how people write numbers locally). */
export function formatBdPhoneLocal(e164: string): string {
  return e164.replace(/^\+880/, '0');
}

export const OTP_LENGTH = 6;

export const phoneSchema = z
  .string()
  .max(30)
  .transform((value, ctx) => {
    const phone = normalizeBdPhone(value);
    if (!phone) {
      ctx.addIssue({ code: 'custom', message: 'INVALID_PHONE' });
      return z.NEVER;
    }
    return phone;
  });

export const otpCodeSchema = z
  .string()
  .max(20)
  .transform((value) => toAsciiDigits(value).replace(/\s/g, ''))
  .pipe(z.string().regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), 'CODE_INVALID'));

// ---------------------------------------------------------------------------
// Requests and responses
// ---------------------------------------------------------------------------

export const otpRequestSchema = z.object({ phone: phoneSchema });

export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: otpCodeSchema,
  /** Required on the first login (a new account); see TERMS_REQUIRED. */
  acceptTerms: z.boolean().optional(),
});

/**
 * The same for every phone, registered or not. A new account is only revealed after a correct
 * code: verify then answers TERMS_REQUIRED and the code stays usable.
 */
export interface OtpRequestResponse {
  /** Seconds before another code can be requested. */
  resendAfterSec: number;
  /** Seconds the code works. */
  expiresInSec: number;
  /** Only when the server runs with OTP_DEV_MODE (no real SMS). */
  devCode?: string;
}

export const userRoleSchema = z.enum(['user', 'admin']);
export const userPlanSchema = z.enum(['free', 'premium']);
export type UserPlan = z.infer<typeof userPlanSchema>;

export interface AuthUser {
  id: string;
  phone: string;
  role: z.infer<typeof userRoleSchema>;
  /** Effective plan: `premium` only while `planExpiresAt` hasn't passed. */
  plan: UserPlan;
  planExpiresAt: string | null;
}

export interface MeResponse {
  user: AuthUser;
}

/** Public login options, so the login screen can show reviewer access and the dev-code toggle. */
export interface AuthOptionsResponse {
  devMode: boolean;
  resendAfterSec: number;
  otpTtlSec: number;
  reviewer: { freePhone: string; premiumPhone: string; code: string } | null;
}

// ---------------------------------------------------------------------------
// Error codes (the web app maps them to Bangla messages)
// ---------------------------------------------------------------------------

export const AUTH_ERROR_CODES = [
  'INVALID_PHONE',
  'CODE_INVALID',
  'CODE_EXPIRED',
  'TOO_MANY_ATTEMPTS',
  'RATE_LIMITED',
  'TERMS_REQUIRED',
  'SMS_UNAVAILABLE',
  'SMS_FAILED',
  'SERVICE_UNAVAILABLE',
  'UNAUTHENTICATED',
  'FORBIDDEN',
] as const;
export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];
