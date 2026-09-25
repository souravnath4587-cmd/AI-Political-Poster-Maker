import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  sourcemap: true,
  clean: true,
  // Workspace packages export TypeScript source, so bundle them into the output.
  noExternal: ['@app/shared'],
});
