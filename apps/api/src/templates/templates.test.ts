import { describe, expect, it } from 'vitest';
import { layoutConfigSchema, templateRequirements } from '@app/shared';
import { TEMPLATE_SEEDS } from '.';

describe('seeded templates', () => {
  it('have unique slugs', () => {
    const slugs = TEMPLATE_SEEDS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it.each(TEMPLATE_SEEDS.map((s) => [s.slug, s] as const))(
    '%s passes layoutConfig validation',
    (_slug, seed) => {
      const result = layoutConfigSchema.safeParse(seed.layoutConfig);
      expect(result.success ? [] : result.error.issues).toEqual([]);
    },
  );

  it('victory day needs leader 1 and the requester; leader 2 and the symbol are optional', () => {
    const seed = TEMPLATE_SEEDS.find((s) => s.slug === 'victory-day-classic')!;
    const { photos } = templateRequirements(layoutConfigSchema.parse(seed.layoutConfig));
    expect(photos).toEqual([
      { field: 'leader1Photo', optional: false },
      { field: 'leader2Photo', optional: true },
      { field: 'requesterPhoto', optional: false },
      { field: 'partySymbol', optional: true },
    ]);
  });

  it('every template has a default headline and message', () => {
    for (const seed of TEMPLATE_SEEDS) {
      expect(seed.layoutConfig.defaults?.headline).toBeTruthy();
      expect(seed.layoutConfig.defaults?.message).toBeTruthy();
    }
  });
});
