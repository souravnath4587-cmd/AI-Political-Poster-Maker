import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Sets env vars before any module (config/env.ts) is imported.
    setupFiles: ['./test/setup-env.ts'],
    testTimeout: 20_000,
    // Starting an in-memory MongoDB can take a few seconds.
    hookTimeout: 60_000,
  },
});
