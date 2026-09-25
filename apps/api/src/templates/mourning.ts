import type { LayoutConfigInput } from '@app/shared';
import { footerElements } from './footer';
import type { TemplateSeed } from './types';

interface Geometry {
  headline: { y: number; h: number; max: number };
  photo: { size: number; y: number };
  nameY: number;
  message: { y: number; h: number; max: number };
  footer: { top: number; height: number };
}

function layout(g: Geometry): LayoutConfigInput['sizes']['a3'] {
  const titleY = g.nameY + 6.5;
  const dividerY = titleY + 5.5;

  return {
    background: {
      color: 'night',
      layers: [
        'radial-gradient(ellipse 75% 40% at 50% 38%, rgba(70,70,70,0.9) 0%, rgba(18,18,18,0) 100%)',
        'linear-gradient(180deg, #1f1f1f 0%, #0b0b0b 100%)',
      ],
    },
    elements: [
      // Mourning sash across the top-right corner.
      {
        kind: 'shape',
        id: 'sash',
        box: { x: 64, y: 8, w: 60, h: 5.5 },
        fill: '#d9d9d9',
        rotate: 45,
      },
      {
        kind: 'shape',
        id: 'sashStripe',
        box: { x: 64, y: 10, w: 60, h: 1.5 },
        fill: '#000000',
        rotate: 45,
      },
      {
        kind: 'text',
        id: 'headline',
        field: 'headline',
        box: { x: 10, y: g.headline.y, w: 80, h: g.headline.h },
        font: 'serif',
        weight: 800,
        size: { min: 6, max: g.headline.max },
        maxLines: 2,
        lineHeight: 1.3,
        color: 'white',
        effect: 'poster-3d',
        effectColor: 'black',
      },
      {
        kind: 'photo',
        id: 'leader1Photo',
        field: 'leader1Photo',
        box: { x: 50 - g.photo.size / 2, y: g.photo.y, w: g.photo.size, h: g.photo.size },
        border: { width: 1.2, color: 'white' },
        shadow: true,
      },
      {
        kind: 'text',
        id: 'leader1Name',
        field: 'leader1Name',
        box: { x: 8, y: g.nameY, w: 84, h: 6.5 },
        font: 'serif',
        weight: 700,
        size: { min: 3.4, max: 5.2 },
        color: 'white',
        effect: 'soft-shadow',
      },
      {
        kind: 'text',
        id: 'leader1Title',
        field: 'leader1Title',
        box: { x: 10, y: titleY, w: 80, h: 4.5 },
        font: 'body',
        weight: 500,
        size: { min: 2.2, max: 3 },
        color: 'silver',
      },
      {
        kind: 'shape',
        id: 'divider',
        box: { x: 38, y: dividerY, w: 24, h: 0.35 },
        fill: '#9e9e9e',
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
        color: 'mist',
        effect: 'soft-shadow',
      },
      ...footerElements({
        top: g.footer.top,
        height: g.footer.height,
        panelFill: '#f2f2f2',
        lineFill: '#b71c1c',
        colors: { credit: 'red', name: 'ink', text: 'inkSoft', photoBorder: 'ink' },
      }),
    ],
  };
}

const layoutConfig: LayoutConfigInput = {
  version: 1,
  colors: {
    night: '#121212',
    white: '#ffffff',
    black: '#000000',
    silver: '#cfcfcf',
    mist: '#e6e6e6',
    red: '#b71c1c',
    ink: '#1a1a1a',
    inkSoft: '#3d3d3d',
  },
  defaults: {
    headline: 'গভীর শোক',
    message:
      'প্রয়াত নেতার বিদেহী আত্মার শান্তি কামনা করছি এবং শোকসন্তপ্ত পরিবারের প্রতি গভীর সমবেদনা জানাচ্ছি।',
  },
  sizes: {
    // 100 × 125 vw
    social45: layout({
      headline: { y: 4, h: 16, max: 11 },
      photo: { size: 40, y: 21 },
      nameY: 63,
      message: { y: 77, h: 20, max: 4.2 },
      footer: { top: 99, height: 26 },
    }),
    // 100 × 141.4 vw
    a3: layout({
      headline: { y: 4.5, h: 18, max: 12 },
      photo: { size: 46, y: 24 },
      nameY: 72,
      message: { y: 88, h: 23, max: 4.6 },
      footer: { top: 114.4, height: 27 },
    }),
  },
};

export const mourning: TemplateSeed = {
  slug: 'mourning-tribute',
  title: 'শোক ও শ্রদ্ধাঞ্জলি',
  occasionType: 'mourning',
  description: 'প্রয়াত নেতার ছবি সহ শোক ও শ্রদ্ধাঞ্জলি পোস্টার',
  sortOrder: 20,
  layoutConfig,
};
