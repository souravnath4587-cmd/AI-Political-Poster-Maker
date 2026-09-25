// Real Chromium renders of every template: the checks from `scripts/render-sample.ts`, in `pnpm test`.
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';
import { layoutConfigSchema, OUTPUT_SIZES, outputSizeSchema, type OutputSize } from '@app/shared';
import { closeBrowser, openPageCount, renderPoster } from '../services/render';
import { SAMPLE_CONTENT, TEMPLATE_SEEDS } from '../templates';
import { buildPosterHtml, type PosterContent } from './posterHtml';

const sixty = (text: string) => text.repeat(3).slice(0, 60);

const VARIANTS: Record<string, PosterContent> = {
  'two leaders': SAMPLE_CONTENT,
  'one leader': {
    ...SAMPLE_CONTENT,
    photos: { ...SAMPLE_CONTENT.photos, leader2Photo: undefined },
  },
  // Worst case from the acceptance criteria: 60-character name and designation.
  '60-character text': {
    ...SAMPLE_CONTENT,
    text: {
      ...SAMPLE_CONTENT.text,
      name: sixty('মোহাম্মদ আব্দুল্লাহ আল মামুন চৌধুরী শান্ত '),
      designation: sixty('কেন্দ্রীয় কার্যনির্বাহী কমিটির সহ-সাংগঠনিক সম্পাদক '),
      organization: sixty('বাংলাদেশ জাতীয় যুব সংগঠন, কেন্দ্রীয় কমিটি, ঢাকা মহানগর '),
    },
  },
};

const cases = TEMPLATE_SEEDS.flatMap((seed) =>
  Object.keys(VARIANTS).flatMap((variant) =>
    (outputSizeSchema.options as OutputSize[]).map((size) => [seed.slug, variant, size] as const),
  ),
);

afterAll(() => closeBrowser());

describe('poster rendering (real Chromium)', () => {
  it.each(cases)(
    '%s, %s, %s: exact size, fonts loaded, no text overflow',
    async (slug, variant, size) => {
      const seed = TEMPLATE_SEEDS.find((s) => s.slug === slug)!;
      const config = layoutConfigSchema.parse(seed.layoutConfig);
      const { html, requiredFonts } = buildPosterHtml(config, size, VARIANTS[variant]!, {
        watermark: true,
      });

      // renderPoster throws if a required Bangla font didn't load.
      const result = await renderPoster(html, { size, requiredFonts });

      const meta = await sharp(result.png).metadata();
      const expected = OUTPUT_SIZES[size];
      expect([meta.width, meta.height, meta.density]).toEqual([
        expected.width,
        expected.height,
        expected.dpi,
      ]);
      expect(result.fit.filter((f) => f.overflow).map((f) => f.id)).toEqual([]);
      expect(result.renderMs).toBeLessThan(30_000);
    },
    60_000,
  );

  it('leaves no pages open after many renders', async () => {
    const config = layoutConfigSchema.parse(TEMPLATE_SEEDS[0]!.layoutConfig);
    const { html, requiredFonts } = buildPosterHtml(config, 'social45', SAMPLE_CONTENT);
    for (let i = 0; i < 5; i++) await renderPoster(html, { size: 'social45', requiredFonts });
    expect(await openPageCount()).toBe(0);
  }, 60_000);
});
