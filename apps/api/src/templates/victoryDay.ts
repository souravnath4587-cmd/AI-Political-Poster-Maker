import type { LayoutConfigInput, TemplateElementInput } from '@app/shared';
import { footerElements } from './footer';
import type { TemplateSeed } from './types';

const PADDY_STRIPES =
  'repeating-linear-gradient(100deg, rgba(247,208,70,0.24) 0 0.5vw, rgba(247,208,70,0) 0.5vw 1.7vw)';
const SUN_RAYS =
  'repeating-conic-gradient(from 0deg at 50% 22%, rgba(255,255,255,0.04) 0deg 6deg, rgba(255,255,255,0) 6deg 12deg)';

interface Geometry {
  bandHeight: number;
  sun: { size: number; centerY: number };
  twoLeaders: { size: number; y: number; nameY: number };
  oneLeader: { size: number; nameY: number };
  headline: { y: number; h: number; max: number };
  message: { y: number; h: number; max: number };
  stripes: { y: number; h: number };
  footer: { top: number; height: number };
}

function leaderText(
  n: 1 | 2,
  box: { x: number; w: number },
  nameY: number,
  showIf: TemplateElementInput['showIf'],
  suffix: string,
): TemplateElementInput[] {
  return [
    {
      kind: 'text',
      id: `leader${n}Name${suffix}`,
      field: `leader${n}Name`,
      box: { x: box.x, y: nameY, w: box.w, h: 5.2 },
      font: 'body',
      weight: 700,
      size: { min: 2.4, max: 3.6 },
      color: 'white',
      effect: 'soft-shadow',
      showIf,
    },
    {
      kind: 'text',
      id: `leader${n}Title${suffix}`,
      field: `leader${n}Title`,
      box: { x: box.x, y: nameY + 5.2, w: box.w, h: 3.8 },
      font: 'body',
      weight: 500,
      size: { min: 1.8, max: 2.6 },
      color: 'goldLight',
      effect: 'soft-shadow',
      showIf,
    },
  ];
}

function layout(g: Geometry): LayoutConfigInput['sizes']['a3'] {
  const two = { field: 'leader2Photo', present: true } as const;
  const one = { field: 'leader2Photo', present: false } as const;
  const sunX = 50 - g.sun.size / 2;
  const sunY = g.sun.centerY - g.sun.size / 2;
  const twoX = [25 - g.twoLeaders.size / 2, 75 - g.twoLeaders.size / 2];
  const oneX = 50 - g.oneLeader.size / 2;
  const oneY = g.sun.centerY - g.oneLeader.size / 2;
  const photoBorder = { width: 1, color: 'gold' };

  return {
    background: {
      color: 'greenDark',
      layers: [SUN_RAYS, 'linear-gradient(180deg, #003d2c 0%, #006a4e 50%, #0b7a55 100%)'],
    },
    elements: [
      {
        kind: 'shape',
        id: 'sun',
        box: { x: sunX, y: sunY, w: g.sun.size, h: g.sun.size },
        fill: '#f42a41',
        radius: 'full',
      },
      {
        kind: 'shape',
        id: 'paddy',
        box: { x: 0, y: g.stripes.y, w: 100, h: g.stripes.h },
        fill: PADDY_STRIPES,
        fade: 'top',
      },
      {
        kind: 'shape',
        id: 'band',
        box: { x: 0, y: 0, w: 100, h: g.bandHeight },
        fill: 'rgba(0,0,0,0.28)',
      },
      {
        kind: 'shape',
        id: 'bandLine',
        box: { x: 0, y: g.bandHeight, w: 100, h: 0.4 },
        fill: '#f7d046',
      },
      {
        kind: 'text',
        id: 'date',
        text: '১৬ই ডিসেম্বর',
        box: { x: 4, y: 0, w: 92, h: g.bandHeight },
        font: 'body',
        weight: 600,
        size: { min: 2.6, max: 3.6 },
        color: 'gold',
      },

      // Two leaders side by side…
      {
        kind: 'photo',
        id: 'leader1Photo',
        field: 'leader1Photo',
        box: { x: twoX[0]!, y: g.twoLeaders.y, w: g.twoLeaders.size, h: g.twoLeaders.size },
        border: photoBorder,
        shadow: true,
        showIf: two,
      },
      {
        kind: 'photo',
        id: 'leader2Photo',
        field: 'leader2Photo',
        box: { x: twoX[1]!, y: g.twoLeaders.y, w: g.twoLeaders.size, h: g.twoLeaders.size },
        border: photoBorder,
        shadow: true,
        optional: true,
      },
      ...leaderText(1, { x: 7, w: 36 }, g.twoLeaders.nameY, two, ''),
      ...leaderText(2, { x: 57, w: 36 }, g.twoLeaders.nameY, two, ''),

      // …or one leader, larger and centered on the sun.
      {
        kind: 'photo',
        id: 'leader1PhotoSolo',
        field: 'leader1Photo',
        box: { x: oneX, y: oneY, w: g.oneLeader.size, h: g.oneLeader.size },
        border: photoBorder,
        shadow: true,
        showIf: one,
      },
      ...leaderText(1, { x: 20, w: 60 }, g.oneLeader.nameY, one, 'Solo'),

      {
        kind: 'text',
        id: 'headline',
        field: 'headline',
        box: { x: 4, y: g.headline.y, w: 92, h: g.headline.h },
        font: 'serif',
        weight: 800,
        size: { min: 6, max: g.headline.max },
        maxLines: 2,
        lineHeight: 1.3,
        color: 'gold',
        effect: 'poster-3d',
        effectColor: 'maroon',
      },
      {
        kind: 'text',
        id: 'message',
        field: 'message',
        box: { x: 8, y: g.message.y, w: 84, h: g.message.h },
        font: 'body',
        weight: 500,
        size: { min: 2.6, max: g.message.max },
        maxLines: 0,
        lineHeight: 1.6,
        color: 'white',
        effect: 'soft-shadow',
      },
      ...footerElements({
        top: g.footer.top,
        height: g.footer.height,
        panelFill: '#ffffff',
        lineFill: '#f42a41',
        colors: { credit: 'red', name: 'ink', text: 'ink', photoBorder: 'green' },
      }),
    ],
  };
}

const layoutConfig: LayoutConfigInput = {
  version: 1,
  colors: {
    green: '#006a4e',
    greenDark: '#003d2c',
    red: '#f42a41',
    gold: '#f7d046',
    goldLight: '#ffe9a8',
    maroon: '#7a0010',
    white: '#ffffff',
    ink: '#004d38',
  },
  defaults: {
    headline: 'মহান বিজয় দিবস',
    message:
      'স্বাধীনতা সংগ্রামের সকল বীর শহীদের প্রতি বিনম্র শ্রদ্ধাঞ্জলি। ত্রিশ লক্ষ শহীদের রক্তে অর্জিত স্বাধীনতা ও গণতন্ত্র রক্ষায় আমরা ঐক্যবদ্ধ।',
  },
  sizes: {
    // 100 × 125 vw
    social45: layout({
      bandHeight: 7,
      sun: { size: 42, centerY: 27 },
      twoLeaders: { size: 25, y: 10, nameY: 37 },
      oneLeader: { size: 30, nameY: 43 },
      headline: { y: 52, h: 21, max: 12 },
      message: { y: 74, h: 23, max: 4.6 },
      stripes: { y: 60, h: 38 },
      footer: { top: 99, height: 26 },
    }),
    // 100 × 141.4 vw: the extra height goes to bigger photos, headline and message.
    a3: layout({
      bandHeight: 7.5,
      sun: { size: 46, centerY: 31 },
      twoLeaders: { size: 28, y: 11, nameY: 41 },
      oneLeader: { size: 34, nameY: 49.5 },
      headline: { y: 60, h: 26, max: 13 },
      message: { y: 87, h: 25, max: 5 },
      stripes: { y: 70, h: 43 },
      footer: { top: 114.4, height: 27 },
    }),
  },
};

export const victoryDay: TemplateSeed = {
  slug: 'victory-day-classic',
  title: 'বিজয় দিবস — লাল সূর্য',
  occasionType: 'victory_day',
  description: 'সবুজ-লাল পতাকার রঙে বিজয় দিবসের পোস্টার, ১ বা ২ জন নেতার ছবি সহ',
  sortOrder: 10,
  layoutConfig,
};
