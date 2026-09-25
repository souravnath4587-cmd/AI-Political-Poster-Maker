import { describe, expect, it } from 'vitest';
import { layoutConfigSchema } from '@app/shared';
import { SAMPLE_CONTENT, TEMPLATE_SEEDS } from '../templates';
import { escapeHtml } from '../lib/html';
import { buildPosterHtml, PHOTO_PLACEHOLDER } from './posterHtml';

const victory = layoutConfigSchema.parse(
  TEMPLATE_SEEDS.find((s) => s.slug === 'victory-day-classic')!.layoutConfig,
);

const hasElement = (html: string, id: string) => html.includes(`data-el="${id}"`);
// Boolean checks: a failing toContain() would print the whole page, fonts included (~600 KB).
const has = (html: string, text: string) => html.includes(text);

describe('buildPosterHtml', () => {
  it('escapes user text', () => {
    const { html } = buildPosterHtml(victory, 'social45', {
      ...SAMPLE_CONTENT,
      text: { ...SAMPLE_CONTENT.text, name: '<img src=x onerror=alert(1)>"' },
    });
    expect(has(html, '&lt;img src=x onerror=alert(1)&gt;&quot;')).toBe(true);
    expect(has(html, '<img src=x')).toBe(false);
  });

  it('uses the template default when a text field is empty', () => {
    const { html } = buildPosterHtml(victory, 'social45', {
      ...SAMPLE_CONTENT,
      text: { ...SAMPLE_CONTENT.text, headline: '   ' },
    });
    expect(has(html, 'মহান বিজয় দিবস')).toBe(true);
  });

  it('switches to the one-leader layout when leader 2 is missing', () => {
    const two = buildPosterHtml(victory, 'a3', SAMPLE_CONTENT).html;
    const solo = buildPosterHtml(victory, 'a3', {
      ...SAMPLE_CONTENT,
      photos: { ...SAMPLE_CONTENT.photos, leader2Photo: undefined },
    }).html;

    expect(hasElement(two, 'leader1Photo')).toBe(true);
    expect(hasElement(two, 'leader2Photo')).toBe(true);
    expect(hasElement(two, 'leader1PhotoSolo')).toBe(false);

    expect(hasElement(solo, 'leader1PhotoSolo')).toBe(true);
    expect(hasElement(solo, 'leader1Photo')).toBe(false);
    expect(hasElement(solo, 'leader2Photo')).toBe(false);
    expect(hasElement(solo, 'leader2Name')).toBe(false);
  });

  it('leaves out optional photos and uses a placeholder for missing required ones', () => {
    const { html } = buildPosterHtml(victory, 'social45', { text: {}, photos: {} });
    expect(hasElement(html, 'partySymbol')).toBe(false);
    expect(hasElement(html, 'requesterPhoto')).toBe(true);
    expect(has(html, escapeHtml(PHOTO_PLACEHOLDER))).toBe(true);
  });

  it('applies the face focus point to the photo', () => {
    const { html } = buildPosterHtml(victory, 'social45', {
      ...SAMPLE_CONTENT,
      photos: {
        ...SAMPLE_CONTENT.photos,
        requesterPhoto: { url: 'https://res.cloudinary.com/x.jpg', focus: { x: 40, y: 25 } },
      },
    });
    expect(has(html, 'object-position:40% 25%')).toBe(true);
  });

  it('reports only the fonts the layout uses', () => {
    const { requiredFonts } = buildPosterHtml(victory, 'social45', SAMPLE_CONTENT);
    expect(requiredFonts.sort()).toEqual(['Hind Siliguri', 'Noto Serif Bengali']);
  });
});
