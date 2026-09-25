import { describe, expect, it } from 'vitest';
import {
  layoutConfigSchema,
  posterHeightVw,
  templateRequirements,
  type LayoutConfigInput,
  type TemplateElementInput,
} from './template';

function config(
  elements: TemplateElementInput[],
  extra: Partial<LayoutConfigInput> = {},
): LayoutConfigInput {
  const size = { background: { color: 'bg' }, elements };
  return {
    version: 1,
    colors: { bg: '#000000', ink: '#ffffff' },
    sizes: { a3: size, social45: size },
    ...extra,
  };
}

const headline: TemplateElementInput = {
  kind: 'text',
  id: 'headline',
  field: 'headline',
  box: { x: 5, y: 5, w: 90, h: 20 },
  font: 'serif',
  size: { min: 5, max: 10 },
  color: 'ink',
};

function issues(input: LayoutConfigInput): string[] {
  const result = layoutConfigSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

describe('layoutConfigSchema', () => {
  it('accepts a minimal config and fills in defaults', () => {
    const parsed = layoutConfigSchema.parse(config([headline]));
    const el = parsed.sizes.social45.elements[0]!;
    expect(el.kind === 'text' && el.maxLines).toBe(1);
    expect(parsed.defaults).toEqual({});
  });

  it('rejects unknown color tokens', () => {
    expect(issues(config([{ ...headline, color: 'gold' }]))).toContain(
      'Unknown color token "gold"',
    );
  });

  it('rejects duplicate element ids', () => {
    expect(issues(config([headline, headline]))).toContain('Duplicate id "headline"');
  });

  it('rejects text that has both or neither of field and text', () => {
    const both = { ...headline, text: 'fixed' } as TemplateElementInput;
    const neither = { ...headline, field: undefined } as TemplateElementInput;
    expect(issues(config([both]))[0]).toMatch(/exactly one of "field" or "text"/);
    expect(issues(config([neither]))[0]).toMatch(/exactly one of "field" or "text"/);
  });

  it('rejects a minimum font size above the maximum', () => {
    const inverted = { ...headline, size: { min: 9, max: 4 } } as TemplateElementInput;
    expect(issues(config([inverted]))).toContain('size.min is larger than size.max');
  });

  it("rejects content outside the poster, using each size's height", () => {
    // 4:5 is 125 vw tall; A3 is about 141.5 vw.
    expect(posterHeightVw('social45')).toBeCloseTo(125);
    expect(posterHeightVw('a3')).toBeCloseTo(141.45, 1);
    const low = { ...headline, box: { x: 5, y: 130, w: 90, h: 8 } } as TemplateElementInput;
    const messages = issues(config([low]));
    expect(messages.some((m) => m.includes('outside the social45 poster'))).toBe(true);
    expect(messages.some((m) => m.includes('outside the a3 poster'))).toBe(false);
  });

  it('lets decorative shapes bleed off the edge', () => {
    const sash: TemplateElementInput = {
      kind: 'shape',
      id: 'sash',
      box: { x: 70, y: -5, w: 60, h: 5 },
      fill: '#fff',
    };
    expect(issues(config([headline, sash]))).toEqual([]);
  });

  it('requires circle photos to be square', () => {
    const photo: TemplateElementInput = {
      kind: 'photo',
      id: 'p',
      field: 'leader1Photo',
      box: { x: 10, y: 10, w: 20, h: 25 },
    };
    expect(issues(config([photo]))).toContain('Circle photo "p" must be square (w = h)');
  });

  it.each([
    'url(https://evil.example/x.png)',
    'red; position: fixed',
    '#fff} body {display:none',
    'expression(alert(1))',
  ])('rejects unsafe CSS paint: %s', (fill) => {
    const shape: TemplateElementInput = {
      kind: 'shape',
      id: 's',
      box: { x: 0, y: 0, w: 10, h: 10 },
      fill,
    };
    expect(issues(config([headline, shape])).length).toBeGreaterThan(0);
  });

  it('only accepts background images from Cloudinary over https', () => {
    const withImage = (imageUrl: string) =>
      config([headline], {
        sizes: {
          a3: { background: { color: 'bg', imageUrl }, elements: [headline] },
          social45: { background: { color: 'bg' }, elements: [headline] },
        },
      });
    expect(issues(withImage('https://res.cloudinary.com/demo/image/upload/bg.png'))).toEqual([]);
    expect(issues(withImage('https://example.com/bg.png')).length).toBeGreaterThan(0);
    expect(issues(withImage('http://res.cloudinary.com/demo/bg.png')).length).toBeGreaterThan(0);
  });
});

describe('templateRequirements', () => {
  it('treats a photo as required unless it is optional in every slot', () => {
    const photo = (
      id: string,
      field: 'leader1Photo' | 'leader2Photo',
      optional: boolean,
    ): TemplateElementInput => ({
      kind: 'photo',
      id,
      field,
      box: { x: 10, y: 30, w: 20, h: 20 },
      optional,
      // showIf picks a layout variant; it must not make leader 1 optional.
      showIf: { field: 'leader2Photo', present: field === 'leader1Photo' },
    });
    const req = templateRequirements(
      layoutConfigSchema.parse(
        config([headline, photo('l1', 'leader1Photo', false), photo('l2', 'leader2Photo', true)]),
      ),
    );
    expect(req.photos).toEqual([
      { field: 'leader1Photo', optional: false },
      { field: 'leader2Photo', optional: true },
    ]);
    expect(req.textFields).toEqual(['headline']);
  });
});
