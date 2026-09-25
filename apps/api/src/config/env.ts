import { existsSync } from 'node:fs';
import { z } from 'zod';

// Local development reads apps/api/.env; hosts (Render) inject real env vars.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const cloudinaryKeys = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
] as const;

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
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    for (const key of cloudinaryKeys) {
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
