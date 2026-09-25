import { describe, expect, it } from 'vitest';
import { layoutConfigSchema } from '@app/shared';
import { SAMPLE_CONTENT, TEMPLATE_SEEDS } from '../templates';
import { escapeHtml } from '../lib/html';
import { buildPosterHtml, coverPosition, PHOTO_PLACEHOLDER } from './posterHtml';

describe('coverPosition', () => {
  const square = { w: 20, h: 20 };

  it('centers the focus point of a landscape photo in a square frame', () => {
    // 2000×1000 in a square: the photo is twice as wide as the frame, so x can move.
    expect(coverPosition({ x: 50, y: 50 }, { width: 2000, height: 1000 }, square)).toEqual({
      x: 50,
      y: 50,
    });
    // A face at 25% of the width: p = (0.25·2 − 0.5) / (2 − 1) = 0 → left edge.
    expect(coverPosition({ x: 25, y: 50 }, { width: 2000, height: 1000 }, square).x).toBe(0);
    // A face at 60%: p = (1.2 − 0.5) / 1 = 0.7.
    expect(coverPosition({ x: 60, y: 50 }, { width: 2000, height: 1000 }, square).x).toBe(70);
  });

  it('moves a portrait photo up to a face near the top, without leaving a gap', () => {
    // 1000×1500: y can move. A face at 30%: p = (0.45 − 0.5) / 0.5 = −0.1 → clamped to 0.
    expect(coverPosition({ x: 50, y: 30 }, { width: 1000, height: 1500 }, square).y).toBe(0);
    // A face at 45%: p = (0.675 − 0.5) / 0.5 = 0.35.
    expect(coverPosition({ x: 50, y: 45 }, { width: 1000, height: 1500 }, square).y).toBe(35);
  });

  it('keeps 50% on an axis with nothing to crop', () => {
    expect(coverPosition({ x: 10, y: 90 }, { width: 1000, height: 1000 }, square)).toEqual({
      x: 50,
      y: 50,
    });
  });
});

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
