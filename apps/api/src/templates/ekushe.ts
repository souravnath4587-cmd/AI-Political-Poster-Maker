import type { LayoutConfigInput, TemplateElementInput } from '@app/shared';
import { footerElements } from './footer';
import {
  circleBox,
  leaderText,
  pill,
  WITH_LEADER2,
  WITHOUT_LEADER2,
  type LeaderTextStyle,
} from './parts';
import type { TemplateSeed } from './types';

interface Geometry {
  date: { y: number; h: number };
  headline: { y: number; h: number; max: number };
  /** Shaheed Minar: bottom of the columns (vw) and a scale factor. */
  minar: { base: number; scale: number };
  message: { y: number; h: number; max: number };
  twoLeaders: { size: number; y: number; nameY: number };
  oneLeader: { size: number; y: number; nameY: number };
  footer: { top: number; height: number };
}

const TEXT: LeaderTextStyle = { nameColor: 'ink', titleColor: 'red', effect: 'none' };
const TEXT_SOLO: LeaderTextStyle = {
  ...TEXT,
  align: 'left',
  nameSize: { min: 2.6, max: 4.2 },
  titleSize: { min: 2, max: 3 },
};

const INK = '#1b1b1b';
const PAPER = '#f4ede0';

/** A Shaheed Minar column: a dark frame with the paper color showing through the middle. */
function column(
  id: string,
  cx: number,
  top: number,
  base: number,
  w: number,
  s: number,
  rotate = 0,
): TemplateElementInput[] {
  const frame = 1.1 * s;
  return [
    { kind: 'shape', id, box: { x: cx - w / 2, y: top, w, h: base - top }, fill: INK, rotate },
    {
      kind: 'shape',
      id: `${id}Inner`,
      box: { x: cx - w / 2 + frame, y: top + frame, w: w - 2 * frame, h: base - top - frame },
      fill: PAPER,
      rotate,
    },
  ];
}

/** Red sun behind five framed columns; the middle one bends forward at the top. */
function minar({ base, scale: s }: Geometry['minar']): TemplateElementInput[] {
  return [
    {
      kind: 'shape',
      id: 'sunGlow',
      box: circleBox(50, base - 19 * s, 36 * s),
      fill: 'radial-gradient(circle, rgba(200,16,46,0.22) 0%, rgba(200,16,46,0) 70%)',
      radius: 'full',
    },
    {
      kind: 'shape',
      id: 'sun',
      box: circleBox(50, base - 19 * s, 25 * s),
      fill: 'radial-gradient(circle at 40% 35%, #e8334f 0%, #c8102e 60%, #a00c24 100%)',
      radius: 'full',
    },
    ...column('colOuterL', 50 - 16 * s, base - 13 * s, base, 4.6 * s, s),
    ...column('colOuterR', 50 + 16 * s, base - 13 * s, base, 4.6 * s, s),
    ...column('colInnerL', 50 - 8.5 * s, base - 19 * s, base, 5.2 * s, s),
    ...column('colInnerR', 50 + 8.5 * s, base - 19 * s, base, 5.2 * s, s),
    ...column('colMid', 50, base - 24 * s, base, 7 * s, s),
    // The bent head of the middle column, leaning forward.
    ...column('colMidHead', 50 + 1.6 * s, base - 31.5 * s, base - 23 * s, 7 * s, s, 22),
    {
      kind: 'shape',
      id: 'plinth',
      box: { x: 50 - 23 * s, y: base, w: 46 * s, h: 1.8 * s },
      fill: INK,
      radius: 0.4,
    },
    {
      kind: 'shape',
      id: 'plinthStep',
      box: { x: 50 - 27 * s, y: base + 1.8 * s, w: 54 * s, h: 1.2 * s },
      fill: '#4a4a4a',
      radius: 0.4,
    },
  ];
}

/** Faint Bangla letters scattered in the background, for the language movement. */
function letters(g: Geometry): TemplateElementInput[] {
  const s = g.minar.scale;
  const spots: [string, number, number, number][] = [
    ['অ', 7, g.minar.base - 30 * s, 9],
    ['আ', 80, g.minar.base - 33 * s, 8],
    ['ক', 5, g.minar.base - 12 * s, 7],
    ['খ', 86, g.minar.base - 14 * s, 9],
    ['ম', 17, g.minar.base - 22 * s, 6],
    ['ভা', 73, g.minar.base - 22 * s, 6],
  ];
  return spots.map(([text, x, y, size], i) => ({
    kind: 'text' as const,
    id: `letter${i}`,
    text,
    box: { x, y, w: size * 1.6, h: size * 1.4 },
    font: 'serif' as const,
    weight: 700,
    size: { min: size, max: size },
    color: 'faint',
  }));
}

function layout(g: Geometry): LayoutConfigInput['sizes']['a3'] {
  const border = { width: 0.8, color: 'ink' };
  const two = g.twoLeaders;
  const one = g.oneLeader;

  return {
    background: {
      color: 'paper',
      layers: [
        'radial-gradient(ellipse 80% 40% at 50% 32%, rgba(200,16,46,0.08) 0%, rgba(200,16,46,0) 100%)',
        'linear-gradient(180deg, #faf6ee 0%, #efe6d4 100%)',
      ],
    },
    elements: [
      ...letters(g),
      ...pill({
        id: 'date',
        text: '২১শে ফেব্রুয়ারি',
        cx: 50,
        y: g.date.y,
        w: 42,
        h: g.date.h,
        fill: INK,
        color: 'white',
      }),
      {
        kind: 'text',
        id: 'headline',
        field: 'headline',
        box: { x: 6, y: g.headline.y, w: 88, h: g.headline.h },
        font: 'serif',
        weight: 800,
        size: { min: 5.5, max: g.headline.max },
        maxLines: 2,
        lineHeight: 1.2,
        color: 'red',
        effect: 'poster-3d',
        effectColor: 'maroon',
      },
      ...minar(g.minar),
      {
        kind: 'text',
        id: 'message',
        field: 'message',
        box: { x: 7, y: g.message.y, w: 86, h: g.message.h },
        font: 'body',
        weight: 500,
        size: { min: 2.4, max: g.message.max },
        maxLines: 0,
        lineHeight: 1.55,
        color: 'ink',
      },

      // Two leaders in a row…
      {
        kind: 'photo',
        id: 'leader1Photo',
        field: 'leader1Photo',
        box: { x: 27 - two.size / 2, y: two.y, w: two.size, h: two.size },
        shape: 'rounded',
        border,
        shadow: true,
        showIf: WITH_LEADER2,
      },
      {
        kind: 'photo',
        id: 'leader2Photo',
        field: 'leader2Photo',
        box: { x: 73 - two.size / 2, y: two.y, w: two.size, h: two.size },
        shape: 'rounded',
        border,
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
        shape: 'rounded',
        border,
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
        panelFill: INK,
        lineFill: '#c8102e',
        colors: { credit: 'redLight', name: 'white', text: 'paperDim', photoBorder: 'red' },
      }),
    ],
  };
}

const layoutConfig: LayoutConfigInput = {
  version: 1,
  colors: {
    paper: PAPER,
    paperDim: '#e6dcc8',
    ink: INK,
    faint: '#1b1b1b14',
    red: '#c8102e',
    redLight: '#ff5a6e',
    maroon: '#5c0010',
    white: '#ffffff',
  },
  defaults: {
    headline: 'অমর একুশে',
    message:
      'ভাষা আন্দোলনের সকল শহীদের প্রতি গভীর শ্রদ্ধা। মায়ের ভাষার মর্যাদা রক্ষায় আমরা অঙ্গীকারবদ্ধ।',
  },
  sizes: {
    // 100 × 125 vw
    social45: layout({
      date: { y: 3.5, h: 6 },
      headline: { y: 10.5, h: 13, max: 11 },
      minar: { base: 55, scale: 1 },
      message: { y: 59.5, h: 10, max: 3.8 },
      twoLeaders: { size: 17, y: 70.5, nameY: 88 },
      oneLeader: { size: 21, y: 71, nameY: 77 },
      footer: { top: 99, height: 26 },
    }),
    // 100 × 141.4 vw
    a3: layout({
      date: { y: 4, h: 7 },
      headline: { y: 12.5, h: 15, max: 12.5 },
      minar: { base: 64, scale: 1.15 },
      message: { y: 69.5, h: 12.5, max: 4.4 },
      twoLeaders: { size: 19, y: 83, nameY: 103 },
      oneLeader: { size: 25, y: 83.5, nameY: 91.5 },
      footer: { top: 114.4, height: 27 },
    }),
  },
};

export const ekushe: TemplateSeed = {
  slug: 'ekushe-february',
  title: 'শহীদ দিবস — ২১শে ফেব্রুয়ারি',
  occasionType: 'national_day',
  description:
    'শহীদ মিনার ও লাল সূর্যের সাথে একুশে ফেব্রুয়ারির শ্রদ্ধাঞ্জলি পোস্টার, ১ বা ২ জন নেতার ছবি সহ',
  sortOrder: 50,
  layoutConfig,
};
