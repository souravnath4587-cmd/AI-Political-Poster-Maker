import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// apps/api/assets (fonts, template thumbnails). `pnpm dev` and the Docker image run with apps/api
// as the working directory; a Vercel function may start from the repo root or its own folder, so
// fall back to the monorepo path and to the folder next to the bundle (dist/../assets).
const candidates = [
  resolve(process.cwd(), 'assets'),
  resolve(process.cwd(), 'apps/api/assets'),
  resolve(dirname(fileURLToPath(import.meta.url)), '../assets'),
];

export const ASSETS_DIR = candidates.find((dir) => existsSync(dir)) ?? candidates[0]!;
