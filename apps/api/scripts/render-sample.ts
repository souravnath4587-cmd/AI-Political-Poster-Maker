// Phase 1 render check: writes sample posters to .data/renders and reports timing, sizes and leaks.
//   pnpm --filter @app/api render:sample
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { OUTPUT_SIZES, type OutputSize } from '@app/shared';
import { closeBrowser, openPageCount, renderPoster } from '../src/services/render';
import {
  buildTestPosterHtml,
  SAMPLE_POSTER,
  TEST_POSTER_FONTS,
  type TestPosterData,
} from '../src/render/testPoster';

const outDir = resolve(import.meta.dirname, '../.data/renders');
mkdirSync(outDir, { recursive: true });

const sixty = (text: string) => text.repeat(3).slice(0, 60);

// Worst case from the acceptance criteria: 60-character name and designation.
const LONG_TEXT: TestPosterData = {
  ...SAMPLE_POSTER,
  requester: {
    ...SAMPLE_POSTER.requester,
    name: sixty('মোহাম্মদ আব্দুল্লাহ আল মামুন চৌধুরী শান্ত '),
    designation: sixty('কেন্দ্রীয় কার্যনির্বাহী কমিটির সহ-সাংগঠনিক সম্পাদক '),
  },
};

async function renderToFile(name: string, data: TestPosterData, size: OutputSize) {
  const result = await renderPoster(buildTestPosterHtml(data), {
    size,
    requiredFonts: TEST_POSTER_FONTS,
  });
  const file = resolve(outDir, `${name}-${size}.png`);
  writeFileSync(file, result.png);

  const meta = await sharp(result.png).metadata();
  const expected = OUTPUT_SIZES[size];
  const sizeOk = meta.width === expected.width && meta.height === expected.height;
  const overflow = result.fit.filter((f) => f.overflow).map((f) => f.id);

  console.log(
    `${name}-${size}: ${meta.width}×${meta.height} @${meta.density}dpi ${sizeOk ? 'OK' : 'WRONG SIZE'}, ` +
      `${result.renderMs} ms, ${(result.png.length / 1024 / 1024).toFixed(1)} MB, ` +
      `overflow: ${overflow.length ? overflow.join(', ') : 'none'}`,
  );
  for (const f of result.fit) console.log(`    ${f.id}: ${f.fontSizePx}px, ${f.lines} line(s)`);
  return sizeOk && overflow.length === 0;
}

let ok = true;
for (const size of ['social45', 'a3'] as const) {
  ok = (await renderToFile('sample', SAMPLE_POSTER, size)) && ok;
  ok = (await renderToFile('long-text', LONG_TEXT, size)) && ok;
}

// 10 renders in a row: pages must not leak and time/memory must stay flat.
const html = buildTestPosterHtml(SAMPLE_POSTER);
const times: number[] = [];
for (let i = 0; i < 10; i++) {
  const { renderMs } = await renderPoster(html, {
    size: 'social45',
    requiredFonts: TEST_POSTER_FONTS,
  });
  times.push(renderMs);
}
const leaked = await openPageCount();
console.log(`10× social45: ${times.join(', ')} ms; open pages after: ${leaked}`);
console.log(`API process RSS: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`);
ok = ok && leaked === 0;

await closeBrowser();
console.log(ok ? 'RENDER CHECK PASSED' : 'RENDER CHECK FAILED');
process.exit(ok ? 0 : 1);
