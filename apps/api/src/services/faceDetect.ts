import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import type { FocusPoint } from '@app/shared';
import { env } from '../config/env';
import { logger } from '../lib/logger';

/** Per call. */
const TIMEOUT_MS = 5_000;
/** All attempts together; the upload waits for this at most. */
const TOTAL_BUDGET_MS = 10_000;
const RETRY_DELAY_MS = 300;
/** Don't start a retry with less time than a typical call needs (~2–4 s). */
const MIN_RETRY_MS = 3_000;

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
  /** The model that answered (or was tried last). */
  model?: string;
  latencyMs: number;
  error?: string;
}

// Gemini's detection format: box_2d = [ymin, xmin, ymax, xmax] on a 0–1000 scale.
const responseSchema = z.object({
  faces: z.array(
    z.object({
      box_2d: z.array(z.number().min(0).max(1000)).length(4),
      confidence: z.number().min(0).max(1).optional(),
    }),
  ),
});

/** Faces the model is less sure about are ignored (the default crop is safer than a wrong one). */
const MIN_CONFIDENCE = 0.6;

const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    faces: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          box_2d: { type: 'array', items: { type: 'integer' }, minItems: 4, maxItems: 4 },
          confidence: { type: 'number' },
        },
        required: ['box_2d', 'confidence'],
      },
    },
  },
  required: ['faces'],
};

// Tested wording: without "only the face" lighter models box the whole person, and without
// "do not guess" they invent a face on plain or abstract images.
const PROMPT =
  'Detect every clearly visible human face in this photo. Do not guess: if there is no real human ' +
  'face (for example a plain background, a logo, text or scenery), return {"faces": []}. A face box ' +
  'covers only the face, from the top of the forehead to the chin and from ear to ear; it must not ' +
  'include the neck, shoulders or body. For each face return box_2d as [ymin, xmin, ymax, xmax] ' +
  'normalized to 0-1000 and confidence from 0 to 1 that it is a real human face.';

let client: GoogleGenAI | null = null;

/** Busy, rate-limited or timed-out calls are worth trying once more, on the other model. */
function isRetryable(err: unknown): boolean {
  const status = (err as { status?: unknown })?.status;
  if (status === 429 || status === 503 || status === 500) return true;
  if (!(err instanceof Error)) return false;
  return (
    err.name === 'AbortError' ||
    err.name === 'TimeoutError' ||
    /"code":\s*(429|500|503)|UNAVAILABLE|RESOURCE_EXHAUSTED|aborted/i.test(err.message)
  );
}

function callGemini(ai: GoogleGenAI, model: string, jpeg: Buffer, timeoutMs: number) {
  return ai.models.generateContent({
    model,
    contents: [
      { inlineData: { mimeType: 'image/jpeg', data: jpeg.toString('base64') } },
      { text: PROMPT },
    ],
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: RESPONSE_JSON_SCHEMA,
      temperature: 0,
      abortSignal: AbortSignal.timeout(timeoutMs),
    },
  });
}

/**
 * Finds the largest face with Gemini: GEMINI_VISION_MODEL first, GEMINI_MODEL if that one is
 * busy or slow. Never throws; on any failure the caller gets `face: null` and uses the default crop.
 */
export async function detectFace(jpeg: Buffer): Promise<FaceDetection> {
  if (!env.GEMINI_API_KEY) return { face: null, attempted: false, latencyMs: 0 };
  client ??= new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const ai = client;

  const models = [...new Set([env.GEMINI_VISION_MODEL, env.GEMINI_MODEL])];
  const started = performance.now();
  const elapsed = () => performance.now() - started;
  let model = models[0]!;

  try {
    let response;
    for (let i = 0; ; i++) {
      model = models[i]!;
      const remaining = TOTAL_BUDGET_MS - elapsed();
      try {
        response = await callGemini(ai, model, jpeg, Math.floor(Math.min(TIMEOUT_MS, remaining)));
        break;
      } catch (err) {
        const hasNext = i + 1 < models.length;
        if (!hasNext || !isRetryable(err) || TOTAL_BUDGET_MS - elapsed() < MIN_RETRY_MS) throw err;
        logger.info(
          { model, err: err instanceof Error ? err.message.slice(0, 120) : err },
          'Face detection busy; trying the fallback model',
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }

    const { faces } = responseSchema.parse(JSON.parse(response.text ?? ''));
    const boxes = faces
      .filter((f) => (f.confidence ?? 1) >= MIN_CONFIDENCE)
      .map(({ box_2d: [ymin, xmin, ymax, xmax] }) => ({
        x: xmin! / 10,
        y: ymin! / 10,
        w: (xmax! - xmin!) / 10,
        h: (ymax! - ymin!) / 10,
      }))
      .filter((b) => b.w > 0 && b.h > 0);
    const largest = boxes.sort((a, b) => b.w * b.h - a.w * a.h)[0] ?? null;

    return { face: largest, attempted: true, model, latencyMs: Math.round(elapsed()) };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.warn(
      { model, err: error.slice(0, 200) },
      'Face detection failed; using the default crop',
    );
    return {
      face: null,
      attempted: true,
      model,
      latencyMs: Math.round(elapsed()),
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
