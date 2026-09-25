import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Sets env vars before any module (config/env.ts) is imported.
    setupFiles: ['./test/setup-env.ts'],
    testTimeout: 20_000,
    // Starting an in-memory MongoDB can take a few seconds.
    hookTimeout: 60_000,
    // Worker threads, not child processes: on Windows a child process exiting while network
    // handles are closing can abort (exit code 0xC0000409, libuv UV_HANDLE_CLOSING assertion).
    pool: 'threads',
    // Each test file starts its own in-memory MongoDB; keep memory use modest.
    maxWorkers: 2,
  },
});
