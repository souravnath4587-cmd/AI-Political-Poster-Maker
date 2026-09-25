// Renders every template at both sizes and checks pixel size, DPI, text overflow and leaked pages.
// Images go to apps/api/.data/renders for a visual check.
//   pnpm --filter @app/api render:sample [slug]
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { layoutConfigSchema, OUTPUT_SIZES, outputSizeSchema, type OutputSize } from '@app/shared';
import { buildPosterHtml, type PosterContent } from '../src/render/posterHtml';
import { closeBrowser, openPageCount, renderPoster } from '../src/services/render';
import { SAMPLE_CONTENT, TEMPLATE_SEEDS } from '../src/templates';

const outDir = resolve(import.meta.dirname, '../.data/renders');
mkdirSync(outDir, { recursive: true });

const sixty = (text: string) => text.repeat(3).slice(0, 60);

const VARIANTS: Record<string, PosterContent> = {
  sample: SAMPLE_CONTENT,
  // Leader 2 left out: the layout should switch to one centered leader.
  solo: { ...SAMPLE_CONTENT, photos: { ...SAMPLE_CONTENT.photos, leader2Photo: undefined } },
  // Worst case from the acceptance criteria: 60-character name and designation.
  long: {
    ...SAMPLE_CONTENT,
    text: {
      ...SAMPLE_CONTENT.text,
      name: sixty('মোহাম্মদ আব্দুল্লাহ আল মামুন চৌধুরী শান্ত '),
      designation: sixty('কেন্দ্রীয় কার্যনির্বাহী কমিটির সহ-সাংগঠনিক সম্পাদক '),
      organization: sixty('বাংলাদেশ জাতীয় যুব সংগঠন, কেন্দ্রীয় কমিটি, ঢাকা মহানগর '),
    },
  },
};

const only = process.argv[2];
let ok = true;

for (const seed of TEMPLATE_SEEDS.filter((s) => !only || s.slug === only)) {
  const config = layoutConfigSchema.parse(seed.layoutConfig);

  for (const [variant, content] of Object.entries(VARIANTS)) {
    for (const size of outputSizeSchema.options as OutputSize[]) {
      const { html, requiredFonts } = buildPosterHtml(config, size, content);
      const result = await renderPoster(html, { size, requiredFonts });
      const name = `${seed.slug}-${variant}-${size}`;
      writeFileSync(resolve(outDir, `${name}.png`), result.png);

      const meta = await sharp(result.png).metadata();
      const expected = OUTPUT_SIZES[size];
      const sizeOk = meta.width === expected.width && meta.height === expected.height;
      const overflow = result.fit.filter((f) => f.overflow).map((f) => f.id);
      ok = ok && sizeOk && overflow.length === 0;

      console.log(
        `${name}: ${meta.width}×${meta.height} @${meta.density}dpi ${sizeOk ? 'OK' : 'WRONG SIZE'}, ` +
          `${result.renderMs} ms, overflow: ${overflow.length ? overflow.join(', ') : 'none'}`,
      );
    }
  }
}

// 10 renders in a row: pages must not leak.
const first = layoutConfigSchema.parse(TEMPLATE_SEEDS[0]!.layoutConfig);
const { html, requiredFonts } = buildPosterHtml(first, 'social45', SAMPLE_CONTENT);
const times: number[] = [];
for (let i = 0; i < 10; i++) {
  times.push((await renderPoster(html, { size: 'social45', requiredFonts })).renderMs);
}
const leaked = await openPageCount();
console.log(`10× social45: ${times.join(', ')} ms; open pages after: ${leaked}`);
ok = ok && leaked === 0;

await closeBrowser();
console.log(ok ? 'RENDER CHECK PASSED' : 'RENDER CHECK FAILED');
process.exit(ok ? 0 : 1);
