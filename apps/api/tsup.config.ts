import { defineConfig } from 'tsup';

export default defineConfig({
  // server.ts: Docker/Render and local production runs; vercel.ts: the Vercel function.
  entry: ['src/server.ts', 'src/vercel.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  sourcemap: true,
  clean: true,
  // Workspace packages export TypeScript source, so bundle them into the output.
  noExternal: ['@app/shared'],
});
