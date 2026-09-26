import { z } from 'zod';
import { OUTPUT_SIZES, outputSizeSchema, type OutputSize } from './render';

// ---------------------------------------------------------------------------
// Occasions and poster fields
// ---------------------------------------------------------------------------

export const occasionTypeSchema = z.enum([
  'victory_day',
  'national_day',
  'mourning',
  'election',
  'greeting',
  'festival',
]);
export type OccasionType = z.infer<typeof occasionTypeSchema>;

export const OCCASION_LABELS: Record<OccasionType, string> = {
  victory_day: 'বিজয় দিবস',
  national_day: 'জাতীয় দিবস',
  mourning: 'শোক/স্মরণ',
  election: 'নির্বাচনী প্রচার',
  greeting: 'শুভেচ্ছা',
  festival: 'উৎসব',
};

/** Text a template can show. Values come from the poster form or the template's `defaults`. */
export const TEXT_FIELDS = [
  'headline',
  'message',
  'name',
  'designation',
  'organization',
  'location',
  'leader1Name',
  'leader1Title',
  'leader2Name',
  'leader2Title',
] as const;
export const textFieldSchema = z.enum(TEXT_FIELDS);
export type TextField = z.infer<typeof textFieldSchema>;

/** Images a template can show (uploaded by the user). */
export const PHOTO_FIELDS = [
  'leader1Photo',
  'leader2Photo',
  'requesterPhoto',
  'partySymbol',
] as const;
export const photoFieldSchema = z.enum(PHOTO_FIELDS);
export type PhotoField = z.infer<typeof photoFieldSchema>;

// ---------------------------------------------------------------------------
// Building blocks. All lengths are in vw: percent of the poster's width.
// ---------------------------------------------------------------------------

const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i, 'Expected a hex color like #006a4e');

const colorToken = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'Expected a color token name');

/**
 * A CSS color or gradient, e.g. `linear-gradient(180deg, #003d2c, #006a4e)`.
 * Restricted characters: no url(), quotes, semicolons or braces, so it can't escape its declaration.
 */
const cssPaint = z
  .string()
  .max(500)
  .regex(/^[a-z0-9#(),.%\s+-]+$/i, 'Only colors and gradients are allowed')
  .refine((value) => !/url\s*\(|expression/i.test(value), 'url() is not allowed');

const slotId = z.string().regex(/^[a-zA-Z][a-zA-Z0-9-]*$/, 'Expected an id like leader1Photo');

const length = z.number().min(-50).max(250);

export const boxSchema = z.object({
  x: length,
  y: length,
  w: z.number().positive().max(250),
  h: z.number().positive().max(250),
});
export type Box = z.infer<typeof boxSchema>;

const showIfSchema = z.object({
  field: z.enum([...TEXT_FIELDS, ...PHOTO_FIELDS]),
  present: z.boolean(),
});

const textElementSchema = z.object({
  kind: z.literal('text'),
  id: slotId,
  /** Bound to a poster field... */
  field: textFieldSchema.optional(),
  /** ...or fixed text such as "প্রচারে:". Exactly one of the two. */
  text: z.string().min(1).max(200).optional(),
  box: boxSchema,
  font: z.enum(['serif', 'sans', 'body']),
  weight: z.number().int().min(100).max(900).default(400),
  /** Font size range in vw; the renderer picks the largest size that fits. */
  size: z.object({ min: z.number().positive(), max: z.number().positive() }),
  /** 0 = as many lines as fit in the box. */
  maxLines: z.number().int().min(0).max(8).default(1),
  align: z.enum(['left', 'center', 'right']).default('center'),
  valign: z.enum(['top', 'center', 'bottom']).default('center'),
  color: colorToken,
  lineHeight: z.number().min(0.9).max(2.2).default(1.4),
  effect: z.enum(['none', 'soft-shadow', 'poster-3d', 'glow', 'outline']).default('none'),
  /** Color of the 3D shadow or outline; defaults to near-black. */
  effectColor: colorToken.optional(),
  showIf: showIfSchema.optional(),
});

const photoElementSchema = z.object({
  kind: z.literal('photo'),
  id: slotId,
  field: photoFieldSchema,
  box: boxSchema,
  shape: z.enum(['circle', 'rounded', 'rect']).default('circle'),
  /** `contain` for logos/symbols so nothing is cropped. */
  fit: z.enum(['cover', 'contain']).default('cover'),
  border: z.object({ width: z.number().min(0).max(5), color: colorToken }).optional(),
  shadow: z.boolean().default(false),
  /** Optional slots are left out when the user doesn't upload that photo. */
  optional: z.boolean().default(false),
  showIf: showIfSchema.optional(),
});

const shapeElementSchema = z.object({
  kind: z.literal('shape'),
  id: slotId,
  box: boxSchema,
  fill: cssPaint,
  radius: z.union([z.number().min(0), z.literal('full')]).default(0),
  opacity: z.number().min(0).max(1).default(1),
  rotate: z.number().min(-180).max(180).default(0),
  /** Fade the shape out toward one edge (e.g. paddy stripes fading upward). */
  fade: z.enum(['none', 'top', 'bottom']).default('none'),
  showIf: showIfSchema.optional(),
});

export const elementSchema = z.discriminatedUnion('kind', [
  textElementSchema,
  photoElementSchema,
  shapeElementSchema,
]);
export type TemplateElement = z.infer<typeof elementSchema>;
/** An element as written in a template file, before defaults are applied. */
export type TemplateElementInput = z.input<typeof elementSchema>;
export type TextElement = z.infer<typeof textElementSchema>;
export type PhotoElement = z.infer<typeof photoElementSchema>;
export type ShapeElement = z.infer<typeof shapeElementSchema>;
export type ShowIf = z.infer<typeof showIfSchema>;

const backgroundSchema = z.object({
  color: colorToken,
  /** CSS background layers, painted top first (same order as CSS `background`). */
  layers: z.array(cssPaint).max(8).default([]),
  /** Optional image (e.g. a Gemini-generated background) under the layers. */
  imageUrl: z.url({ protocol: /^https$/, hostname: /^res\.cloudinary\.com$/ }).optional(),
});

const sizeLayoutSchema = z.object({
  background: backgroundSchema,
  /** Painted in order: later elements sit on top. */
  elements: z.array(elementSchema).min(1).max(80),
});
export type SizeLayout = z.infer<typeof sizeLayoutSchema>;

// ---------------------------------------------------------------------------
// layoutConfig
// ---------------------------------------------------------------------------

/** Poster height in vw for an output size (width is always 100). */
export function posterHeightVw(size: OutputSize): number {
  const spec = OUTPUT_SIZES[size];
  return (spec.cssHeight / spec.cssWidth) * 100;
}

const EDGE_TOLERANCE = 0.5;

export const layoutConfigSchema = z
  .object({
    version: z.literal(1),
    colors: z.record(colorToken, hexColor),
    /** Text used when the user leaves a field empty (e.g. the occasion's standard message). */
    defaults: z.partialRecord(textFieldSchema, z.string().min(1).max(300)).default({}),
    sizes: z.object({ a3: sizeLayoutSchema, social45: sizeLayoutSchema }),
  })
  .superRefine((config, ctx) => {
    const tokens = new Set(Object.keys(config.colors));
    const checkToken = (token: string, path: (string | number)[]) => {
      if (!tokens.has(token)) {
        ctx.addIssue({ code: 'custom', path, message: `Unknown color token "${token}"` });
      }
    };

    for (const size of outputSizeSchema.options) {
      const layout = config.sizes[size];
      const base = ['sizes', size];
      const heightVw = posterHeightVw(size);
      const ids = new Set<string>();

      checkToken(layout.background.color, [...base, 'background', 'color']);

      layout.elements.forEach((el, i) => {
        const path = [...base, 'elements', i];

        if (ids.has(el.id)) {
          ctx.addIssue({
            code: 'custom',
            path: [...path, 'id'],
            message: `Duplicate id "${el.id}"`,
          });
        }
        ids.add(el.id);

        // Content must be fully on the poster; decorative shapes may bleed off the edge.
        if (el.kind !== 'shape') {
          const { x, y, w, h } = el.box;
          if (
            x < -EDGE_TOLERANCE ||
            y < -EDGE_TOLERANCE ||
            x + w > 100 + EDGE_TOLERANCE ||
            y + h > heightVw + EDGE_TOLERANCE
          ) {
            ctx.addIssue({
              code: 'custom',
              path: [...path, 'box'],
              message: `"${el.id}" is outside the ${size} poster (100 × ${heightVw.toFixed(1)} vw)`,
            });
          }
        }

        if (el.kind === 'text') {
          if (Boolean(el.field) === Boolean(el.text)) {
            ctx.addIssue({
              code: 'custom',
              path,
              message: `"${el.id}" needs exactly one of "field" or "text"`,
            });
          }
          if (el.size.min > el.size.max) {
            ctx.addIssue({
              code: 'custom',
              path: [...path, 'size'],
              message: 'size.min is larger than size.max',
            });
          }
          checkToken(el.color, [...path, 'color']);
          if (el.effectColor) checkToken(el.effectColor, [...path, 'effectColor']);
        }

        if (el.kind === 'photo') {
          if (el.shape === 'circle' && Math.abs(el.box.w - el.box.h) > 0.01) {
            ctx.addIssue({
              code: 'custom',
              path: [...path, 'box'],
              message: `Circle photo "${el.id}" must be square (w = h)`,
            });
          }
          if (el.border) checkToken(el.border.color, [...path, 'border', 'color']);
        }
      });
    }
  });

export type LayoutConfig = z.infer<typeof layoutConfigSchema>;
/** layoutConfig as written in a template file, before defaults are applied. */
export type LayoutConfigInput = z.input<typeof layoutConfigSchema>;

// ---------------------------------------------------------------------------
// What a template needs from the poster form
// ---------------------------------------------------------------------------

export interface TemplateRequirements {
  /** Photo fields used, and whether each can be left out. */
  photos: { field: PhotoField; optional: boolean }[];
  /** Text fields shown on the poster. */
  textFields: TextField[];
}

/** Collects the fields used in either output size. A photo is optional only if it's optional everywhere. */
export function templateRequirements(config: LayoutConfig): TemplateRequirements {
  const photos = new Map<PhotoField, boolean>();
  const textFields = new Set<TextField>();

  for (const size of outputSizeSchema.options) {
    for (const el of config.sizes[size].elements) {
      if (el.kind === 'photo') {
        // `showIf` only picks a layout variant (e.g. leader 1 centered when there's no leader 2);
        // it doesn't make the photo optional. Only the explicit flag does.
        photos.set(el.field, (photos.get(el.field) ?? true) && el.optional);
      }
      if (el.kind === 'text' && el.field) textFields.add(el.field);
    }
  }

  return {
    photos: PHOTO_FIELDS.filter((f) => photos.has(f)).map((field) => ({
      field,
      optional: photos.get(field) ?? true,
    })),
    textFields: TEXT_FIELDS.filter((f) => textFields.has(f)),
  };
}

// ---------------------------------------------------------------------------
// API shapes
// ---------------------------------------------------------------------------

export const templateSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  occasionType: occasionTypeSchema,
  description: z.string(),
  thumbnailUrl: z.string(),
  requirements: z.custom<TemplateRequirements>(),
});
export type TemplateSummary = z.infer<typeof templateSummarySchema>;

export const templateListQuerySchema = z.object({
  occasion: occasionTypeSchema.optional(),
});
