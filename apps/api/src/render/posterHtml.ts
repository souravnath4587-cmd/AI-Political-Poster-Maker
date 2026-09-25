import { PHOTO_FIELDS } from '@app/shared';
import type {
  Box,
  FocusPoint,
  LayoutConfig,
  OutputSize,
  PhotoElement,
  PhotoField,
  ShapeElement,
  ShowIf,
  TextElement,
  TextField,
} from '@app/shared';
import { escapeHtml } from '../lib/html';
import { FONT_FAMILIES, fontFaceCss } from './fonts';

export interface PosterPhoto {
  url: string;
  /** Pixel size; with it, `focus` is centered in the frame exactly. */
  width?: number;
  height?: number;
  /** Point to center in the frame (percent of the photo, e.g. the detected face). */
  focus?: FocusPoint;
}

/**
 * CSS object-position that puts `focus` in the middle of a `box.w × box.h` frame with
 * object-fit: cover. object-position p% aligns the photo's p% point with the frame's p% point,
 * so the value that centers a point has to be solved for per axis; it's clamped so the photo
 * still covers the frame.
 */
export function coverPosition(
  focus: FocusPoint,
  photo: { width: number; height: number },
  box: { w: number; h: number },
): FocusPoint {
  const scale = Math.max(box.w / photo.width, box.h / photo.height);
  const axis = (focusPct: number, scaled: number, frame: number) => {
    const overflow = scaled - frame;
    if (overflow <= 0.001) return 50;
    const p = ((focusPct / 100) * scaled - frame / 2) / overflow;
    return Math.round(Math.min(1, Math.max(0, p)) * 1000) / 10;
  };
  return {
    x: axis(focus.x, photo.width * scale, box.w),
    y: axis(focus.y, photo.height * scale, box.h),
  };
}

export interface PosterContent {
  text: Partial<Record<TextField, string>>;
  photos: Partial<Record<PhotoField, PosterPhoto>>;
}

export interface PosterHtml {
  html: string;
  /** Fonts the page uses; the renderer fails if any of them doesn't load. */
  requiredFonts: string[];
}

/** Grey silhouette shown for a required photo that hasn't been uploaded (thumbnails, previews). */
export const PHOTO_PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='#90a4ae'/><circle cx='50' cy='38' r='18' fill='#eceff1'/><path d='M14 100c0-22 16-36 36-36s36 14 36 36z' fill='#eceff1'/></svg>",
  );

const FONT_STACKS: Record<TextElement['font'], string> = {
  serif: FONT_FAMILIES.serif,
  sans: FONT_FAMILIES.sans,
  body: FONT_FAMILIES.body,
};

const JUSTIFY = { left: 'flex-start', center: 'center', right: 'flex-end' } as const;
const ALIGN_ITEMS = {
  top: 'safe flex-start',
  center: 'safe center',
  bottom: 'safe flex-end',
} as const;

const vw = (n: number) => `${+n.toFixed(3)}vw`;

function boxCss({ x, y, w, h }: Box): string {
  return `left:${vw(x)};top:${vw(y)};width:${vw(w)};height:${vw(h)};`;
}

function effectCss(el: TextElement): string {
  const shade = el.effectColor ? `var(--c-${el.effectColor})` : 'rgba(0,0,0,.85)';
  switch (el.effect) {
    case 'soft-shadow':
      return 'text-shadow:0 .3vw 1vw rgba(0,0,0,.55);';
    case 'poster-3d':
      return `text-shadow:0 .45vw 0 ${shade},0 1vw 2.5vw rgba(0,0,0,.5);`;
    case 'glow':
      return 'text-shadow:0 0 1.2vw rgba(255,255,255,.65);';
    case 'outline':
      return `-webkit-text-stroke:.25vw ${shade};paint-order:stroke fill;`;
    case 'none':
      return '';
  }
}

export function buildPosterHtml(
  config: LayoutConfig,
  size: OutputSize,
  content: PosterContent,
): PosterHtml {
  const layout = config.sizes[size];

  const textValue = (field: TextField): string | undefined =>
    content.text[field]?.trim() || config.defaults[field];

  const isPhotoField = (field: ShowIf['field']): field is PhotoField =>
    (PHOTO_FIELDS as readonly string[]).includes(field);

  const isPresent = (field: ShowIf['field']): boolean =>
    isPhotoField(field) ? Boolean(content.photos[field]) : Boolean(textValue(field));

  const fonts = new Set<string>();

  const renderText = (el: TextElement): string => {
    const value = el.field ? textValue(el.field) : el.text;
    if (!value) return '';
    fonts.add(FONT_STACKS[el.font]);
    const style =
      boxCss(el.box) +
      `font-family:'${FONT_STACKS[el.font]}';font-weight:${el.weight};line-height:${el.lineHeight};` +
      `color:var(--c-${el.color});text-align:${el.align};justify-content:${JUSTIFY[el.align]};` +
      `align-items:${ALIGN_ITEMS[el.valign]};` +
      effectCss(el);
    return (
      `<div class="el fit" data-el="${el.id}" data-fit="${el.id}" data-fit-min="${el.size.min}" ` +
      `data-fit-max="${el.size.max}" data-fit-lines="${el.maxLines}" style="${style}">` +
      `<div><span>${escapeHtml(value)}</span></div></div>`
    );
  };

  const renderPhoto = (el: PhotoElement): string => {
    const photo = content.photos[el.field];
    if (!photo && el.optional) return '';
    const url = photo?.url ?? PHOTO_PLACEHOLDER;
    const focus = photo?.focus ?? { x: 50, y: 50 };
    // Without the photo's size, fall back to using the focus point as the position directly.
    const position =
      photo?.width && photo.height
        ? coverPosition(focus, { width: photo.width, height: photo.height }, el.box)
        : focus;
    const radius = el.shape === 'circle' ? '50%' : el.shape === 'rounded' ? '8%' : '0';
    const border = el.border
      ? `border:${vw(el.border.width)} solid var(--c-${el.border.color});`
      : '';
    const shadow = el.shadow ? 'box-shadow:0 1vw 3vw rgba(0,0,0,.45);' : '';
    return (
      `<div class="el photo" data-el="${el.id}" style="${boxCss(el.box)}border-radius:${radius};${border}${shadow}">` +
      `<img src="${escapeHtml(url)}" alt="" style="object-fit:${el.fit};object-position:${position.x}% ${position.y}%;"></div>`
    );
  };

  const renderShape = (el: ShapeElement): string => {
    const radius = el.radius === 'full' ? '50%' : vw(el.radius);
    const transform = el.rotate ? `transform:rotate(${el.rotate}deg);` : '';
    const mask =
      el.fade === 'none'
        ? ''
        : `-webkit-mask-image:linear-gradient(to ${el.fade === 'top' ? 'bottom' : 'top'},transparent 0%,#000 60%);`;
    return `<div class="el" data-el="${el.id}" style="${boxCss(el.box)}background:${el.fill};border-radius:${radius};opacity:${el.opacity};${transform}${mask}"></div>`;
  };

  const elements = layout.elements
    .filter((el) => !el.showIf || isPresent(el.showIf.field) === el.showIf.present)
    .map((el) => {
      switch (el.kind) {
        case 'text':
          return renderText(el);
        case 'photo':
          return renderPhoto(el);
        case 'shape':
          return renderShape(el);
      }
    })
    .join('\n');

  const colorVars = Object.entries(config.colors)
    .map(([token, hex]) => `--c-${token}:${hex};`)
    .join('');

  const { background } = layout;
  const backgroundImage = background.imageUrl
    ? `<div class="bg" style="background-image:url(&quot;${escapeHtml(background.imageUrl)}&quot;);background-size:cover;background-position:center;"></div>`
    : '';
  const backgroundLayers = background.layers.length
    ? `<div class="bg" style="background:${background.layers.join(',')};"></div>`
    : '';

  const html = `<!doctype html>
<html lang="bn">
<head>
<meta charset="utf-8">
<style>
${fontFaceCss()}
:root{${colorVars}}
*{box-sizing:border-box;margin:0;padding:0;}
html,body{width:100vw;height:100vh;overflow:hidden;}
.poster{position:relative;width:100vw;height:100vh;overflow:hidden;background-color:var(--c-${background.color});}
.bg{position:absolute;inset:0;}
.el{position:absolute;}
.fit{display:flex;overflow:hidden;}
.fit>div{width:100%;}
.photo{overflow:hidden;background:#cfd8dc;}
.photo img{display:block;width:100%;height:100%;}
</style>
</head>
<body>
<main class="poster">
${backgroundImage}${backgroundLayers}
${elements}
</main>
</body>
</html>`;

  return { html, requiredFonts: [...fonts] };
}
