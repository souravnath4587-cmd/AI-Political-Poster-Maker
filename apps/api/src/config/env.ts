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
    GEMINI_MODEL: z.string().min(1).default('gemini-2.5-flash'),

    // --- Auth ---
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    // Secret mixed into one-time-code hashes. Required in production.
    OTP_PEPPER: z.string().min(16).optional(),
    // No real SMS: codes are logged and returned by the API as `devCode`. Anyone who can reach
    // the API can then log in as any number, so only use it for local work and the demo.
    OTP_DEV_MODE: z.stringbool().default(false),
    // Reviewer access: fixed-code logins that never send SMS (seeded by seed-users).
    REVIEWER_FREE_PHONE: optionalBdPhone,
    REVIEWER_PREMIUM_PHONE: optionalBdPhone,
    REVIEWER_CODE: z
      .string()
      .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `Must be ${OTP_LENGTH} digits`)
      .optional(),
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

    if (env.NODE_ENV !== 'production') return;
    for (const key of [...cloudinaryKeys, 'OTP_PEPPER'] as const) {
      if (!env[key])
        ctx.addIssue({ code: 'custom', path: [key], message: 'Required in production' });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';

/** Pepper for code hashes; a fixed value outside production so local setup needs no secret. */
export const otpPepper = env.OTP_PEPPER ?? 'dev-only-pepper-not-secret';

export const reviewer =
  env.REVIEWER_FREE_PHONE && env.REVIEWER_PREMIUM_PHONE && env.REVIEWER_CODE
    ? {
        freePhone: env.REVIEWER_FREE_PHONE,
        premiumPhone: env.REVIEWER_PREMIUM_PHONE,
        code: env.REVIEWER_CODE,
      }
    : null;
