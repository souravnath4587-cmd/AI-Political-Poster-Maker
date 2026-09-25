import type { TemplateElementInput } from '@app/shared';

export interface FooterOptions {
  /** Top of the footer panel, in vw. */
  top: number;
  /** Panel height, in vw (at least 25). */
  height: number;
  panelFill: string;
  lineFill: string;
  /** Color tokens. */
  colors: { credit: string; name: string; text: string; photoBorder: string };
}

/**
 * The requester's credit bar shared by all templates: photo, "প্রচারে:", name, designation,
 * organization and location, plus an optional party symbol on the right.
 */
export function footerElements({
  top,
  height,
  panelFill,
  lineFill,
  colors,
}: FooterOptions): TemplateElementInput[] {
  const photoSize = 19;
  const symbolSize = 14;
  const textX = 27;
  const textW = 53;

  return [
    {
      kind: 'shape',
      id: 'footerLine',
      box: { x: 0, y: top - 1.2, w: 100, h: 1.2 },
      fill: lineFill,
    },
    { kind: 'shape', id: 'footerPanel', box: { x: 0, y: top, w: 100, h: height }, fill: panelFill },
    {
      kind: 'photo',
      id: 'requesterPhoto',
      field: 'requesterPhoto',
      box: { x: 4, y: top + (height - photoSize) / 2, w: photoSize, h: photoSize },
      shape: 'circle',
      border: { width: 0.8, color: colors.photoBorder },
      shadow: true,
    },
    {
      kind: 'photo',
      id: 'partySymbol',
      field: 'partySymbol',
      box: { x: 82, y: top + (height - symbolSize) / 2, w: symbolSize, h: symbolSize },
      shape: 'rounded',
      fit: 'contain',
      optional: true,
    },
    {
      kind: 'text',
      id: 'credit',
      text: 'প্রচারে:',
      box: { x: textX, y: top + 2.5, w: 30, h: 3.5 },
      font: 'body',
      weight: 600,
      size: { min: 2.4, max: 2.4 },
      align: 'left',
      color: colors.credit,
    },
    {
      kind: 'text',
      id: 'name',
      field: 'name',
      // Long names (up to 60 characters) wrap to a second line at a smaller size.
      box: { x: textX, y: top + 6, w: textW, h: 7.2 },
      font: 'body',
      weight: 700,
      size: { min: 2.8, max: 5.2 },
      maxLines: 2,
      valign: 'center',
      align: 'left',
      color: colors.name,
      lineHeight: 1.2,
    },
    {
      kind: 'text',
      id: 'designation',
      field: 'designation',
      box: { x: textX, y: top + 13.2, w: textW, h: 4 },
      font: 'body',
      weight: 600,
      size: { min: 2.2, max: 3 },
      align: 'left',
      color: colors.text,
    },
    {
      kind: 'text',
      id: 'organization',
      field: 'organization',
      box: { x: textX, y: top + 17.2, w: textW, h: 3.8 },
      font: 'body',
      weight: 500,
      size: { min: 2, max: 2.8 },
      align: 'left',
      color: colors.text,
    },
    {
      kind: 'text',
      id: 'location',
      field: 'location',
      box: { x: textX, y: top + 21, w: textW, h: 3.8 },
      font: 'body',
      weight: 400,
      size: { min: 2, max: 2.8 },
      align: 'left',
      color: colors.text,
    },
  ];
}
