import { GoogleGenAI, type ContentListUnion } from '@google/genai';
import { env } from '../config/env';
import { logger } from '../lib/logger';

let client: GoogleGenAI | null = null;

export function geminiConfigured(): boolean {
  return Boolean(env.GEMINI_API_KEY);
}

/** Busy, rate-limited or timed-out calls are worth trying again on the next model. */
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

export interface JsonCallOptions {
  /** Tried in order; the next one is used only if the previous was busy or slow. */
  models: string[];
  contents: ContentListUnion;
  /** JSON Schema for the response (Gemini structured output). */
  schema: unknown;
  temperature?: number;
  /** Per call. */
  timeoutMs: number;
  /** All attempts together. */
  budgetMs: number;
  /** Don't start another attempt with less time left than this. */
  minAttemptMs: number;
}

export interface JsonCallResult {
  /** Parsed JSON (validate it before use). */
  data: unknown;
  /** The model that answered. */
  model: string;
  latencyMs: number;
}

/**
 * One structured-output call with model fallback inside a time budget. Throws the last error
 * if every attempt fails; callers decide what the fallback behavior is.
 */
export async function generateJson(options: JsonCallOptions): Promise<JsonCallResult> {
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
  client ??= new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const ai = client;

  const models = [...new Set(options.models)];
  const started = performance.now();
  const elapsed = () => performance.now() - started;

  for (let i = 0; ; i++) {
    const model = models[i]!;
    const remaining = options.budgetMs - elapsed();
    try {
      const response = await ai.models.generateContent({
        model,
        contents: options.contents,
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: options.schema,
          temperature: options.temperature ?? 0,
          abortSignal: AbortSignal.timeout(Math.floor(Math.min(options.timeoutMs, remaining))),
        },
      });
      return {
        data: JSON.parse(response.text ?? ''),
        model,
        latencyMs: Math.round(elapsed()),
      };
    } catch (err) {
      const hasNext = i + 1 < models.length;
      if (!hasNext || !isRetryable(err) || options.budgetMs - elapsed() < options.minAttemptMs) {
        throw Object.assign(err instanceof Error ? err : new Error(String(err)), {
          model,
          latencyMs: Math.round(elapsed()),
        });
      }
      logger.info(
        { model, err: err instanceof Error ? err.message.slice(0, 120) : err },
        'Gemini busy; trying the fallback model',
      );
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
}
