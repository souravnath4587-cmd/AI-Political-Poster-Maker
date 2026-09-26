import type { LayoutConfigInput } from '@app/shared';
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
  /** Poster height in vw (125 for 4:5, 141.4 for A3). */
  height: number;
  date: { y: number; h: number };
  disc: { size: number; centerY: number };
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

/**
 * Headline on a big red disc (the flag's sun) with a star-burst behind it; the leaders sit in a row
 * at the bottom, or one leader on the left with the name beside the photo.
 */
function layout(g: Geometry): LayoutConfigInput['sizes']['a3'] {
  const photoBorder = { width: 0.9, color: 'gold' };
  const two = g.twoLeaders;
  const one = g.oneLeader;

  return {
    background: {
      color: 'greenDark',
      layers: [
        `repeating-conic-gradient(from 0deg at 50% ${((g.disc.centerY / g.height) * 100).toFixed(1)}%, rgba(255,255,255,0.05) 0deg 5deg, rgba(255,255,255,0) 5deg 10deg)`,
        'linear-gradient(180deg, #00452f 0%, #006a4e 55%, #00452f 100%)',
      ],
    },
    elements: [
      {
        kind: 'shape',
        id: 'discGlow',
        box: circleBox(50, g.disc.centerY, g.disc.size + 8),
        fill: 'radial-gradient(circle, rgba(247,208,70,0.35) 0%, rgba(247,208,70,0) 70%)',
        radius: 'full',
      },
      {
        kind: 'shape',
        id: 'discRing',
        box: circleBox(50, g.disc.centerY, g.disc.size + 2.4),
        fill: '#f7d046',
        radius: 'full',
      },
      {
        kind: 'shape',
        id: 'disc',
        box: circleBox(50, g.disc.centerY, g.disc.size),
        fill: 'radial-gradient(circle at 40% 35%, #ff4d5e 0%, #f42a41 45%, #c0132a 100%)',
        radius: 'full',
      },
      ...pill({
        id: 'date',
        text: '২৬শে মার্চ',
        cx: 50,
        y: g.date.y,
        w: 34,
        h: g.date.h,
        fill: '#f7d046',
        color: 'greenDark',
      }),
      {
        kind: 'text',
        id: 'headline',
        field: 'headline',
        box: { x: 50 - g.disc.size / 2 + 2, y: g.headline.y, w: g.disc.size - 4, h: g.headline.h },
        font: 'serif',
        weight: 800,
        size: { min: 5.5, max: g.headline.max },
        maxLines: 3,
        lineHeight: 1.25,
        color: 'white',
        effect: 'poster-3d',
        effectColor: 'maroon',
      },
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
        panelFill: '#ffffff',
        lineFill: '#f7d046',
        colors: { credit: 'red', name: 'ink', text: 'ink', photoBorder: 'green' },
      }),
    ],
  };
}

const layoutConfig: LayoutConfigInput = {
  version: 1,
  colors: {
    green: '#006a4e',
    greenDark: '#00452f',
    red: '#d71f35',
    gold: '#f7d046',
    goldLight: '#ffe9a8',
    maroon: '#6b0010',
    white: '#ffffff',
    cream: '#fff6dc',
    ink: '#004d38',
  },
  defaults: {
    headline: 'মহান স্বাধীনতা দিবস',
    message:
      'মহান স্বাধীনতা দিবসে সকল বীর মুক্তিযোদ্ধা ও শহীদদের প্রতি গভীর শ্রদ্ধা। স্বাধীনতার চেতনায় এগিয়ে যাক প্রিয় বাংলাদেশ।',
  },
  sizes: {
    // 100 × 125 vw
    social45: layout({
      height: 125,
      date: { y: 3.5, h: 6.5 },
      disc: { size: 42, centerY: 33 },
      headline: { y: 15, h: 36, max: 9.5 },
      message: { y: 56, h: 12, max: 3.9 },
      twoLeaders: { size: 18, y: 69, nameY: 87.5 },
      oneLeader: { size: 24, y: 69.5, nameY: 76.5 },
      footer: { top: 99, height: 26 },
    }),
    // 100 × 141.4 vw
    a3: layout({
      height: 141.4,
      date: { y: 4, h: 7 },
      disc: { size: 48, centerY: 38 },
      headline: { y: 18, h: 40, max: 10.5 },
      message: { y: 64, h: 15, max: 4.5 },
      twoLeaders: { size: 21, y: 80.5, nameY: 102 },
      oneLeader: { size: 27, y: 81.5, nameY: 90 },
      footer: { top: 114.4, height: 27 },
    }),
  },
};

export const independenceDay: TemplateSeed = {
  slug: 'independence-day',
  title: 'স্বাধীনতা দিবস — ২৬শে মার্চ',
  occasionType: 'national_day',
  description: 'লাল সূর্যের উপর শিরোনাম, নিচে ১ বা ২ জন নেতার ছবি সহ স্বাধীনতা দিবসের পোস্টার',
  sortOrder: 40,
  layoutConfig,
};
