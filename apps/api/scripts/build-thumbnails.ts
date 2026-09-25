// Renders each template's 4:5 layout with sample content into assets/thumbnails/<slug>.webp.
// Run after changing a template, then commit the images.
//   pnpm --filter @app/api templates:thumbnails
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { layoutConfigSchema } from '@app/shared';
import { buildPosterHtml } from '../src/render/posterHtml';
import { closeBrowser, renderPoster } from '../src/services/render';
import { SAMPLE_CONTENT, TEMPLATE_SEEDS } from '../src/templates';

const outDir = resolve(import.meta.dirname, '../assets/thumbnails');
mkdirSync(outDir, { recursive: true });

for (const seed of TEMPLATE_SEEDS) {
  const config = layoutConfigSchema.parse(seed.layoutConfig);
  const { html, requiredFonts } = buildPosterHtml(config, 'social45', SAMPLE_CONTENT);
  const { png } = await renderPoster(html, { size: 'social45', requiredFonts });
  const webp = await sharp(png).resize(540).webp({ quality: 82 }).toBuffer();
  writeFileSync(resolve(outDir, `${seed.slug}.webp`), webp);
  console.log(`${seed.slug}.webp  ${(webp.length / 1024).toFixed(0)} KB`);
}

await closeBrowser();
