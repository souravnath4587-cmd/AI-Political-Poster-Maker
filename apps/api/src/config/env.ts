import { existsSync } from 'node:fs';
import { z } from 'zod';
import { normalizeBdPhone, OTP_LENGTH } from '@app/shared';

// Local development reads apps/api/.env; hosts (Render) inject real env vars.
// Tests set their own values and must not pick up a developer's .env.
if (process.env.NODE_ENV !== 'test' && existsSync('.env')) {
  process.loadEnvFile('.env');
}

const cloudinaryKeys = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
] as const;

const optionalBdPhone = z
  .string()
  .optional()
  .transform((value, ctx) => {
    if (!value) return undefined;
    const phone = normalizeBdPhone(value);
    if (!phone) ctx.addIssue({ code: 'custom', message: 'Not a valid Bangladeshi mobile number' });
    return phone ?? undefined;
  });

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    APP_ORIGIN: z.url(),
    MONGODB_URI: z.string().startsWith('mongodb'),
    MONGODB_DB_NAME: z.string().min(1).default('poster-maker'),
    // Optional, comma-separated. For machines whose local DNS proxy refuses the SRV lookups that
    // mongodb+srv:// needs (Node error "querySrv ECONNREFUSED"), e.g. DNS_SERVERS=8.8.8.8,1.1.1.1
    DNS_SERVERS: z
      .string()
      .optional()
      .transform((value) =>
        value
          ?.split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    // Optional in development until uploads exist (Phase 4); required in production.
    CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
    CLOUDINARY_API_KEY: z.string().min(1).optional(),
    CLOUDINARY_API_SECRET: z.string().min(1).optional(),
    // Parallel Chromium renders. Keep at 1 on Render's 512 MB free tier (A3 is memory-heavy).
    RENDER_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(1),
    // Needed in containers without user namespaces (Render). Safe here: pages only load our own HTML.
    CHROME_NO_SANDBOX: z.stringbool().default(false),

    // --- Gemini ---
    // Optional: without a key, photos get the default crop and headline suggestions are off.
    GEMINI_API_KEY: z.string().min(1).optional(),
    // Check the current model list when changing this; names change often.
    // Text (headline suggestions) and the fallback for face detection. gemini-2.5-flash is closed
    // to new API keys (404 "no longer available to new users").
    GEMINI_MODEL: z.string().min(1).default('gemini-3.8-flash'),
    // Face detection: fast and reliable; the prompt keeps its boxes to the face only.
    GEMINI_VISION_MODEL: z.string().min(1).default('gemini-3.1-flash-lite'),

    // Burst limits (middleware/rateLimits.ts). Off only in tests.
    RATE_LIMITS_ENABLED: z.stringbool().default(true),

    // --- Auth ---
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    // Secret mixed into one-time-code hashes. Required in production.
    OTP_PEPPER: z.string().min(16).optional(),
    // No real SMS: codes are logged and returned by the API as `devCode`. Anyone who can reach
    // the API can then log in as any number, so it's refused in production (local work only).
    OTP_DEV_MODE: z.stringbool().default(false),
    // Reviewer access: fixed-code logins that never send SMS (seeded by seed-users).
    REVIEWER_FREE_PHONE: optionalBdPhone,
    REVIEWER_PREMIUM_PHONE: optionalBdPhone,
    REVIEWER_CODE: z
      .string()
      .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `Must be ${OTP_LENGTH} digits`)
      .optional(),
    // One-time codes: how long a code works, the wait between codes, wrong guesses per code, and
    // codes per phone / per IP in any hour (counted in MongoDB, so they hold across instances).
    OTP_TTL_SEC: z.coerce.number().int().min(30).max(900).default(180),
    OTP_RESEND_COOLDOWN_SEC: z.coerce.number().int().min(10).max(600).default(60),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
    OTP_MAX_PER_PHONE_PER_HOUR: z.coerce.number().int().min(1).max(50).default(5),
    OTP_MAX_PER_IP_PER_HOUR: z.coerce.number().int().min(1).max(500).default(20),

    // --- SMS (BulkSMSBD, https://bulksmsbd.net) ---
    // Without these (and without OTP_DEV_MODE), only reviewer numbers can log in.
    BULKSMSBD_API_KEY: z.string().min(1).optional(),
    BULKSMSBD_SENDER_ID: z.string().min(1).optional(),
    BULKSMSBD_API_URL: z.url().default('https://bulksmsbd.net/api/smsapi'),
  })
  .superRefine((env, ctx) => {
    const reviewerKeys = [
      'REVIEWER_FREE_PHONE',
      'REVIEWER_PREMIUM_PHONE',
      'REVIEWER_CODE',
    ] as const;
    const reviewerSet = reviewerKeys.filter((key) => env[key]);
    if (reviewerSet.length > 0 && reviewerSet.length < reviewerKeys.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['REVIEWER_CODE'],
        message: `Set all or none of ${reviewerKeys.join(', ')}`,
      });
    }

    // Only matters when SMS is really sent (e.g. the sender ID can still be awaiting approval).
    if (!env.OTP_DEV_MODE && Boolean(env.BULKSMSBD_API_KEY) !== Boolean(env.BULKSMSBD_SENDER_ID)) {
      ctx.addIssue({
        code: 'custom',
        path: ['BULKSMSBD_SENDER_ID'],
        message: 'Set both or neither of BULKSMSBD_API_KEY, BULKSMSBD_SENDER_ID',
      });
    }

    if (env.NODE_ENV !== 'production') return;
    // Dev mode returns codes in API responses, so anyone could log in as any number.
    if (env.OTP_DEV_MODE) {
      ctx.addIssue({
        code: 'custom',
        path: ['OTP_DEV_MODE'],
        message: 'Not allowed in production (codes would be returned by the API)',
      });
    }
    for (const key of [...cloudinaryKeys, 'OTP_PEPPER'] as const) {
      if (!env[key])
        ctx.addIssue({ code: 'custom', path: [key], message: 'Required in production' });
    }
  });

// `KEY=` with no value (as copied from .env.example) means "not set", not an empty string;
// otherwise optional settings like OTP_PEPPER would fail their length checks.
const setValues = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => value !== undefined && value.trim() !== ''),
);
const parsed = envSchema.safeParse(setValues);

if (!parsed.success) {
  console.error('Invalid environment variables:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';

/** Pepper for code hashes; a fixed value outside production so local setup needs no secret. */
export const otpPepper = env.OTP_PEPPER ?? 'dev-only-pepper-not-secret';

export const bulkSmsBd =
  env.BULKSMSBD_API_KEY && env.BULKSMSBD_SENDER_ID
    ? {
        apiKey: env.BULKSMSBD_API_KEY,
        senderId: env.BULKSMSBD_SENDER_ID,
        url: env.BULKSMSBD_API_URL,
      }
    : null;

export const reviewer =
  env.REVIEWER_FREE_PHONE && env.REVIEWER_PREMIUM_PHONE && env.REVIEWER_CODE
    ? {
        freePhone: env.REVIEWER_FREE_PHONE,
        premiumPhone: env.REVIEWER_PREMIUM_PHONE,
        code: env.REVIEWER_CODE,
      }
    : null;
