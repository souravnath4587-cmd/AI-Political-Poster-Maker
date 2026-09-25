import { z } from 'zod';

export const outputSizeSchema = z.enum(['a3', 'social45']);
export type OutputSize = z.infer<typeof outputSizeSchema>;

/**
 * Each output is laid out at a CSS viewport size, then captured at `deviceScaleFactor`
 * so the PNG has the target pixel size. Templates size everything in vw/vh.
 */
export const OUTPUT_SIZES: Record<
  OutputSize,
  { label: string; cssWidth: number; cssHeight: number; width: number; height: number; dpi: number }
> = {
  // A3 print: 297×420 mm at 300 DPI.
  a3: { label: 'A3 প্রিন্ট', cssWidth: 1240, cssHeight: 1754, width: 3508, height: 4961, dpi: 300 },
  // Facebook feed 4:5.
  social45: {
    label: 'সোশ্যাল ৪:৫',
    cssWidth: 1080,
    cssHeight: 1350,
    width: 1080,
    height: 1350,
    dpi: 72,
  },
};
