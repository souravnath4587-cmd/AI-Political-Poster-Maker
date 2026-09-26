import type { LayoutConfigInput, TemplateElementInput } from '@app/shared';
import { footerElements } from './footer';
import {
  circleBox,
  diamond,
  leaderText,
  pill,
  WITH_LEADER2,
  WITHOUT_LEADER2,
  type LeaderTextStyle,
} from './parts';
import type { TemplateSeed } from './types';

interface Geometry {
  /** Height of the red banner; its scalloped edge hangs below it. */
  band: { h: number; scallop: number };
  date: { y: number; h: number };
  headline: { y: number; h: number; max: number };
  alpona: { cy: number; size: number };
  message: { y: number; h: number; max: number };
  twoLeaders: { size: number; y: number; nameY: number };
  oneLeader: { size: number; y: number; nameY: number };
  /** y of the diamond border above the footer. */
  border: number;
  footer: { top: number; height: number };
}

const TEXT: LeaderTextStyle = { nameColor: 'ink', titleColor: 'red', effect: 'none' };
const TEXT_SOLO: LeaderTextStyle = {
  ...TEXT,
  align: 'left',
  nameSize: { min: 2.6, max: 4.2 },
  titleSize: { min: 2, max: 3 },
};

const RED = '#c8102e';
const YELLOW = '#ffc72c';
const CREAM = '#fff8e7';

/** Alpona: concentric rings over a ring of petals, as one multi-layer paint. */
const ALPONA = [
  `radial-gradient(circle, ${YELLOW} 0 7%, ${RED} 7% 11%, ${CREAM} 11% 17%, ${RED} 17% 20%, rgba(0,0,0,0) 20% 42%, ${RED} 42% 45%, ${CREAM} 45% 55%, ${YELLOW} 55% 57%, ${CREAM} 57% 63%, ${RED} 63% 66%, rgba(0,0,0,0) 66%)`,
  `repeating-conic-gradient(${RED} 0deg 7.5deg, ${CREAM} 7.5deg 15deg)`,
].join(', ');

/** Red banner with a row of half circles hanging from its lower edge. */
function banner({ h, scallop }: Geometry['band']): TemplateElementInput[] {
  const count = Math.ceil(100 / scallop) + 1;
  return [
    {
      kind: 'shape',
      id: 'band',
      box: { x: 0, y: 0, w: 100, h },
      fill: `linear-gradient(180deg, #9e0b24 0%, ${RED} 100%)`,
    },
    ...Array.from({ length: count }, (_, i) => ({
      kind: 'shape' as const,
      id: `scallop${i}`,
      box: circleBox(i * scallop, h, scallop),
      fill: RED,
      radius: 'full' as const,
    })),
  ];
}

/** A row of red and yellow diamonds, like a nakshi border. */
function diamondBorder(y: number): TemplateElementInput[] {
  return Array.from({ length: 23 }, (_, i) =>
    diamond(`border${i}`, 6 + i * 4, y, i % 2 ? 1.6 : 2.2, i % 2 ? YELLOW : RED),
  );
}

function layout(g: Geometry): LayoutConfigInput['sizes']['a3'] {
  const photoBorder = { width: 0.9, color: 'red' };
  const two = g.twoLeaders;
  const one = g.oneLeader;

  return {
    background: {
      color: 'cream',
      layers: [
        'radial-gradient(ellipse 60% 30% at 50% 55%, rgba(255,199,44,0.18) 0%, rgba(255,199,44,0) 100%)',
        `linear-gradient(180deg, ${CREAM} 0%, #fdefd0 100%)`,
      ],
    },
    elements: [
      // Half an alpona on each side, bleeding off the edge.
      {
        kind: 'shape',
        id: 'alponaLeft',
        box: circleBox(-4, g.alpona.cy, g.alpona.size),
        fill: ALPONA,
        radius: 'full',
        opacity: 0.22,
      },
      {
        kind: 'shape',
        id: 'alponaRight',
        box: circleBox(104, g.alpona.cy, g.alpona.size),
        fill: ALPONA,
        radius: 'full',
        opacity: 0.22,
      },
      ...banner(g.band),
      ...pill({
        id: 'date',
        text: 'পহেলা বৈশাখ',
        cx: 50,
        y: g.date.y,
        w: 36,
        h: g.date.h,
        fill: YELLOW,
        color: 'redDark',
      }),
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
        color: 'white',
        effect: 'poster-3d',
        effectColor: 'redDark',
      },
      {
        kind: 'text',
        id: 'message',
        field: 'message',
        box: { x: 9, y: g.message.y, w: 82, h: g.message.h },
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

      ...diamondBorder(g.border),
      ...footerElements({
        top: g.footer.top,
        height: g.footer.height,
        panelFill: `linear-gradient(180deg, ${RED} 0%, #9e0b24 100%)`,
        lineFill: YELLOW,
        colors: { credit: 'yellow', name: 'white', text: 'creamText', photoBorder: 'yellow' },
      }),
    ],
  };
}

const layoutConfig: LayoutConfigInput = {
  version: 1,
  colors: {
    cream: CREAM,
    creamText: '#ffe9d6',
    red: RED,
    redDark: '#6e0716',
    yellow: YELLOW,
    ink: '#3a0a10',
    white: '#ffffff',
  },
  defaults: {
    headline: 'শুভ নববর্ষ',
    message:
      'নতুন বছরে সবার জীবন ভরে উঠুক আনন্দ, শান্তি ও সমৃদ্ধিতে। বাংলা নববর্ষের প্রীতি ও শুভেচ্ছা।',
  },
  sizes: {
    // 100 × 125 vw
    social45: layout({
      band: { h: 27, scallop: 8 },
      date: { y: 3.5, h: 6 },
      headline: { y: 11, h: 13.5, max: 12 },
      alpona: { cy: 46, size: 34 },
      message: { y: 34.5, h: 13, max: 3.8 },
      twoLeaders: { size: 24, y: 52, nameY: 78.5 },
      oneLeader: { size: 27, y: 52.5, nameY: 61.5 },
      border: 93.5,
      footer: { top: 99, height: 26 },
    }),
    // 100 × 141.4 vw
    a3: layout({
      band: { h: 30, scallop: 9 },
      date: { y: 4, h: 7 },
      headline: { y: 12.5, h: 15, max: 13 },
      alpona: { cy: 52, size: 38 },
      message: { y: 38.5, h: 15.5, max: 4.4 },
      twoLeaders: { size: 27, y: 59, nameY: 89 },
      oneLeader: { size: 31, y: 59.5, nameY: 70.5 },
      border: 107.5,
      footer: { top: 114.4, height: 27 },
    }),
  },
};

export const pohelaBoishakh: TemplateSeed = {
  slug: 'pohela-boishakh',
  title: 'শুভ নববর্ষ — পহেলা বৈশাখ',
  occasionType: 'greeting',
  description:
    'লাল-হলুদ আলপনা ও ঝালরের নকশায় বাংলা নববর্ষের শুভেচ্ছা পোস্টার, ১ বা ২ জন নেতার ছবি সহ',
  sortOrder: 70,
  layoutConfig,
};
