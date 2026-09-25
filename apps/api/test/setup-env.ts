// Test configuration. config/env.ts skips apps/api/.env when NODE_ENV is 'test'.
Object.assign(process.env, {
  NODE_ENV: 'test',
  LOG_LEVEL: 'fatal',
  APP_ORIGIN: 'http://localhost:3000',
  // Replaced per test file by an in-memory server (see test/db.ts).
  MONGODB_URI: 'mongodb://127.0.0.1:1/unused',
  OTP_DEV_MODE: 'true',
  REVIEWER_FREE_PHONE: '01999000001',
  REVIEWER_PREMIUM_PHONE: '01999000002',
  REVIEWER_CODE: '123456',
});
