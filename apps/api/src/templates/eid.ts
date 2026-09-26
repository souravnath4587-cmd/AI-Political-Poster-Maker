import type { LayoutConfigInput, TemplateElementInput } from '@app/shared';
import { footerElements } from './footer';
import {
  circleBox,
  diamond,
  leaderText,
  WITH_LEADER2,
  WITHOUT_LEADER2,
  type LeaderTextStyle,
} from './parts';
import type { TemplateSeed } from './types';

interface Geometry {
  crescent: { cx: number; cy: number; size: number };
  headline: { y: number; h: number; max: number };
  message: { y: number; h: number; max: number };
  twoLeaders: { size: number; y: number; nameY: number };
  oneLeader: { size: number; y: number; nameY: number };
  footer: { top: number; height: number };
}

const TEXT: LeaderTextStyle = { nameColor: 'white', titleColor: 'goldLight' };
const TEXT_SOLO: LeaderTextStyle = {
  ...TEXT,
  align: 'left',
  nameSize: { min: 2.6, max: 4.2 },
  titleSize: { min: 2, max: 3 },
};

const GOLD = '#f2c14e';
const SKYLINE = '#050d1d';

/** A gold circle with an offset transparent circle cut out of it. */
function crescent({ cx, cy, size }: Geometry['crescent']): TemplateElementInput[] {
  return [
    {
      kind: 'shape',
      id: 'moonGlow',
      box: circleBox(cx, cy, size * 1.7),
      fill: 'radial-gradient(circle, rgba(242,193,78,0.3) 0%, rgba(242,193,78,0) 65%)',
      radius: 'full',
    },
    {
      kind: 'shape',
      id: 'moon',
      box: circleBox(cx, cy, size),
      fill: `radial-gradient(circle ${(size * 0.43).toFixed(2)}vw at 70% 33%, rgba(0,0,0,0) 99%, ${GOLD} 100%)`,
      radius: 'full',
    },
    diamond('moonStar', cx + size * 0.12, cy + size * 0.02, size * 0.13, '#ffe6a3'),
  ];
}

/** Two hanging lanterns in the top-left corner. */
function lanterns(s: number): TemplateElementInput[] {
  return (
    [
      [13, 7],
      [25, 13],
    ] as const
  ).flatMap(([x, rope], i) => [
    {
      kind: 'shape' as const,
      id: `lantern${i}Rope`,
      box: { x: x - 0.2, y: -1, w: 0.4, h: (rope + 1) * s },
      fill: GOLD,
    },
    {
      kind: 'shape' as const,
      id: `lantern${i}Cap`,
      box: { x: x - 2, y: rope * s, w: 4, h: 1.6 * s },
      fill: '#c9912a',
      radius: 0.6,
    },
    {
      kind: 'shape' as const,
      id: `lantern${i}Body`,
      box: { x: x - 3.2, y: (rope + 1.4) * s, w: 6.4, h: 8.5 * s },
      fill: 'linear-gradient(90deg, #c9912a 0%, #ffe6a3 45%, #f2c14e 70%, #c9912a 100%)',
      radius: 2.2,
    },
    {
      kind: 'shape' as const,
      id: `lantern${i}Light`,
      box: { x: x - 1.4, y: (rope + 3.4) * s, w: 2.8, h: 4.5 * s },
      fill: 'radial-gradient(ellipse, #fff8e0 0%, rgba(255,248,224,0) 100%)',
      radius: 1.4,
    },
    diamond(`lantern${i}Tip`, x, (rope + 10.6) * s, 1.8, '#c9912a'),
  ]);
}

/** Small stars scattered over the sky. */
function stars(s: number): TemplateElementInput[] {
  const spots: [number, number, number, number][] = [
    [38, 6, 1.6, 0.9],
    [48, 13, 1.1, 0.6],
    [57, 5, 1.3, 0.8],
    [8, 22, 1.2, 0.7],
    [33, 20, 1, 0.5],
    [92, 36, 1.4, 0.7],
    [5, 40, 1, 0.5],
    [62, 22, 0.9, 0.5],
  ];
  return spots.map(([x, y, size, opacity], i) =>
    diamond(`star${i}`, x, y * s, size * s, '#ffe6a3', opacity),
  );
}

/** Mosque silhouette standing on the footer line. */
function skyline(bottom: number, s: number): TemplateElementInput[] {
  const shape = (
    id: string,
    box: { x: number; y: number; w: number; h: number },
    radius: number | 'full' = 0,
  ) => ({
    kind: 'shape' as const,
    id,
    box,
    fill: SKYLINE,
    radius,
    opacity: 0.85,
  });
  return [
    shape('domeMain', circleBox(50, bottom - 4 * s, 12 * s), 'full'),
    shape('domeLeft', circleBox(38, bottom - 3 * s, 7 * s), 'full'),
    shape('domeRight', circleBox(62, bottom - 3 * s, 7 * s), 'full'),
    shape('hall', { x: 32, y: bottom - 4 * s, w: 36, h: 4 * s }),
    shape('domeSpire', { x: 49.7, y: bottom - 12.5 * s, w: 0.6, h: 3 * s }),
    // Minarets at the edges, clear of the leader names.
    shape('minaretLeft', { x: 4, y: bottom - 16 * s, w: 2.6, h: 16 * s }, 0.4),
    shape('minaretRight', { x: 93.4, y: bottom - 16 * s, w: 2.6, h: 16 * s }, 0.4),
    shape('minaretLeftTop', circleBox(5.3, bottom - 16.5 * s, 3.4 * s), 'full'),
    shape('minaretRightTop', circleBox(94.7, bottom - 16.5 * s, 3.4 * s), 'full'),
  ];
}

function layout(g: Geometry, s: number): LayoutConfigInput['sizes']['a3'] {
  const photoBorder = { width: 0.9, color: 'gold' };
  const two = g.twoLeaders;
  const one = g.oneLeader;

  return {
    background: {
      color: 'night',
      layers: [
        'radial-gradient(ellipse 70% 30% at 50% 30%, rgba(242,193,78,0.14) 0%, rgba(242,193,78,0) 100%)',
        'linear-gradient(180deg, #071329 0%, #10305a 55%, #0b1f3d 100%)',
      ],
    },
    elements: [
      ...stars(s),
      ...lanterns(s),
      ...crescent(g.crescent),
      ...skyline(g.footer.top - 1.2, s),
      {
        kind: 'text',
        id: 'headline',
        field: 'headline',
        box: { x: 5, y: g.headline.y, w: 90, h: g.headline.h },
        font: 'serif',
        weight: 800,
        size: { min: 6, max: g.headline.max },
        maxLines: 2,
        lineHeight: 1.2,
        color: 'gold',
        effect: 'poster-3d',
        effectColor: 'brown',
      },
      {
        kind: 'text',
        id: 'message',
        field: 'message',
        box: { x: 8, y: g.message.y, w: 84, h: g.message.h },
        font: 'body',
        weight: 500,
        size: { min: 2.4, max: g.message.max },
        maxLines: 0,
        lineHeight: 1.55,
        color: 'cream',
        effect: 'soft-shadow',
      },

      // Two leaders in a row…
      {
        kind: 'photo',
        id: 'leader1Photo',
        field: 'leader1Photo',
        box: { x: 27 - two.size / 2, y: two.y, w: two.size, h: two.size },
        border: photoBorder,
        shadow: true,
        showIf: WITH_LEADER2,
      },
      {
        kind: 'photo',
        id: 'leader2Photo',
        field: 'leader2Photo',
        box: { x: 73 - two.size / 2, y: two.y, w: two.size, h: two.size },
        border: photoBorder,
        shadow: true,
        optional: true,
      },
      ...leaderText(1, { x: 4, w: 46 }, two.nameY, WITH_LEADER2, '', TEXT),
      ...leaderText(2, { x: 50, w: 46 }, two.nameY, WITH_LEADER2, '', TEXT),

      // …or one leader on the left, name beside the photo.
      {
        kind: 'photo',
        id: 'leader1PhotoSolo',
        field: 'leader1Photo',
        box: { x: 8, y: one.y, w: one.size, h: one.size },
        border: photoBorder,
        shadow: true,
        showIf: WITHOUT_LEADER2,
      },
      ...leaderText(
        1,
        { x: 12 + one.size, w: 84 - one.size },
        one.nameY,
        WITHOUT_LEADER2,
        'Solo',
        TEXT_SOLO,
      ),

      ...footerElements({
        top: g.footer.top,
        height: g.footer.height,
        panelFill: 'linear-gradient(180deg, #fffaf0 0%, #fbeecd 100%)',
        lineFill: GOLD,
        colors: { credit: 'brown', name: 'navy', text: 'navy', photoBorder: 'gold' },
      }),
    ],
  };
}

const layoutConfig: LayoutConfigInput = {
  version: 1,
  colors: {
    night: '#0b1f3d',
    navy: '#10305a',
    gold: GOLD,
    goldLight: '#ffe6a3',
    brown: '#7a4a00',
    cream: '#fff4dc',
    white: '#ffffff',
  },
  defaults: {
    headline: 'ঈদ মোবারক',
    message:
      'পবিত্র ঈদের খুশিতে সবাইকে জানাই আন্তরিক শুভেচ্ছা। ঈদের আনন্দ ছড়িয়ে পড়ুক সবার ঘরে ঘরে।',
  },
  sizes: {
    // 100 × 125 vw
    social45: layout(
      {
        crescent: { cx: 76, cy: 16, size: 21 },
        headline: { y: 29, h: 15, max: 13 },
        message: { y: 45, h: 10.5, max: 3.8 },
        twoLeaders: { size: 20, y: 57, nameY: 78.5 },
        oneLeader: { size: 24, y: 57.5, nameY: 65 },
        footer: { top: 99, height: 26 },
      },
      1,
    ),
    // 100 × 141.4 vw
    a3: layout(
      {
        crescent: { cx: 76, cy: 18, size: 24 },
        headline: { y: 33, h: 17, max: 14 },
        message: { y: 51.5, h: 13, max: 4.4 },
        twoLeaders: { size: 23, y: 67, nameY: 91.5 },
        oneLeader: { size: 28, y: 67.5, nameY: 76.5 },
        footer: { top: 114.4, height: 27 },
      },
      1.13,
    ),
  },
};

export const eid: TemplateSeed = {
  slug: 'eid-mubarak',
  title: 'ঈদ মোবারক — চাঁদ-তারা',
  occasionType: 'festival',
  description: 'রাতের আকাশে সোনালি চাঁদ, লণ্ঠন ও মসজিদের ছায়া সহ ঈদের শুভেচ্ছা পোস্টার',
  sortOrder: 60,
  layoutConfig,
};
