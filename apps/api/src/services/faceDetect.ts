import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import type { FocusPoint } from '@app/shared';
import { env } from '../config/env';
import { logger } from '../lib/logger';

const TIMEOUT_MS = 8_000;

/** Crop center when no face is found: middle, slightly high (heads sit in the upper part). */
export const DEFAULT_FOCUS: FocusPoint = { x: 50, y: 40 };

export interface FaceBox {
  /** Percent of image width/height; x, y = top-left corner. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FaceDetection {
  /** Largest face, or null if none was found or detection was skipped/failed. */
  face: FaceBox | null;
  /** False when no API key is configured (no call was made). */
  attempted: boolean;
  latencyMs: number;
  error?: string;
}

// Gemini's detection format: box_2d = [ymin, xmin, ymax, xmax] on a 0–1000 scale.
const responseSchema = z.object({
  faces: z.array(z.object({ box_2d: z.array(z.number().min(0).max(1000)).length(4) })),
});

const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    faces: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          box_2d: { type: 'array', items: { type: 'integer' }, minItems: 4, maxItems: 4 },
        },
        required: ['box_2d'],
      },
    },
  },
  required: ['faces'],
};

const PROMPT =
  'Detect every human face in this photo. For each face return box_2d as ' +
  '[ymin, xmin, ymax, xmax] normalized to 0-1000. Return {"faces": []} if there is no face.';

let client: GoogleGenAI | null = null;

export async function detectFace(jpeg: Buffer): Promise<FaceDetection> {
  if (!env.GEMINI_API_KEY) return { face: null, attempted: false, latencyMs: 0 };
  client ??= new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

  const started = performance.now();
  try {
    const response = await client.models.generateContent({
      model: env.GEMINI_MODEL,
      contents: [
        { inlineData: { mimeType: 'image/jpeg', data: jpeg.toString('base64') } },
        { text: PROMPT },
      ],
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: RESPONSE_JSON_SCHEMA,
        temperature: 0,
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
      },
    });

    const { faces } = responseSchema.parse(JSON.parse(response.text ?? ''));
    const boxes = faces
      .map(({ box_2d: [ymin, xmin, ymax, xmax] }) => ({
        x: xmin! / 10,
        y: ymin! / 10,
        w: (xmax! - xmin!) / 10,
        h: (ymax! - ymin!) / 10,
      }))
      .filter((b) => b.w > 0 && b.h > 0);
    const largest = boxes.sort((a, b) => b.w * b.h - a.w * a.h)[0] ?? null;

    return { face: largest, attempted: true, latencyMs: Math.round(performance.now() - started) };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.warn({ err: error }, 'Face detection failed; using the default crop');
    return {
      face: null,
      attempted: true,
      latencyMs: Math.round(performance.now() - started),
      error: error.slice(0, 500),
    };
  }
}

/** Crop center for a detected face (its middle), or the default. */
export function focusFor(face: FaceBox | null): FocusPoint {
  if (!face) return DEFAULT_FOCUS;
  const round = (n: number) => Math.round(n * 10) / 10;
  return { x: round(face.x + face.w / 2), y: round(face.y + face.h / 2) };
}
