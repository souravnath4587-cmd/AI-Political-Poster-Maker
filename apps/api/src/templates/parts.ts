import type { TemplateElementInput } from '@app/shared';

type ShowIf = TemplateElementInput['showIf'];

/** Layout variants: two leaders side by side, or leader 1 alone. */
export const WITH_LEADER2 = { field: 'leader2Photo', present: true } as const;
export const WITHOUT_LEADER2 = { field: 'leader2Photo', present: false } as const;

export interface LeaderTextStyle {
  /** Color tokens. */
  nameColor: string;
  titleColor: string;
  align?: 'left' | 'center' | 'right';
  nameSize?: { min: number; max: number };
  titleSize?: { min: number; max: number };
  effect?: 'none' | 'soft-shadow';
}

/** A leader's name with their title underneath (5.2 + 3.8 vw tall). */
export function leaderText(
  n: 1 | 2,
  box: { x: number; w: number },
  nameY: number,
  showIf: ShowIf,
  suffix: string,
  style: LeaderTextStyle,
): TemplateElementInput[] {
  const effect = style.effect ?? 'soft-shadow';
  const align = style.align ?? 'center';
  return [
    {
      kind: 'text',
      id: `leader${n}Name${suffix}`,
      field: `leader${n}Name`,
      box: { x: box.x, y: nameY, w: box.w, h: 5.2 },
      font: 'body',
      weight: 700,
      size: style.nameSize ?? { min: 2.4, max: 3.6 },
      align,
      color: style.nameColor,
      effect,
      showIf,
    },
    {
      kind: 'text',
      id: `leader${n}Title${suffix}`,
      field: `leader${n}Title`,
      box: { x: box.x, y: nameY + 5.2, w: box.w, h: 3.8 },
      font: 'body',
      weight: 500,
      size: style.titleSize ?? { min: 1.8, max: 2.6 },
      align,
      color: style.titleColor,
      effect,
      showIf,
    },
  ];
}

/** A circle given by its center and diameter, as a box. */
export function circleBox(cx: number, cy: number, size: number) {
  return { x: cx - size / 2, y: cy - size / 2, w: size, h: size };
}

/** A small four-pointed sparkle (a rotated square), for stars and confetti. */
export function diamond(
  id: string,
  cx: number,
  cy: number,
  size: number,
  fill: string,
  opacity = 1,
): TemplateElementInput {
  return {
    kind: 'shape',
    id,
    box: circleBox(cx, cy, size),
    fill,
    rotate: 45,
    opacity,
  };
}

/** A fixed line of text on a rounded pill, e.g. a date. */
export function pill(options: {
  id: string;
  text: string;
  cx: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  color: string;
}): TemplateElementInput[] {
  const { id, text, cx, y, w, h, fill, color } = options;
  return [
    {
      kind: 'shape',
      id: `${id}Pill`,
      box: { x: cx - w / 2, y, w, h },
      fill,
      radius: h / 2,
    },
    {
      kind: 'text',
      id,
      text,
      box: { x: cx - w / 2 + 1, y, w: w - 2, h },
      font: 'body',
      weight: 700,
      size: { min: h * 0.35, max: h * 0.5 },
      color,
    },
  ];
}
