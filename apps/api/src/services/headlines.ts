import { z } from 'zod';
import {
  HEADLINE_SUGGESTION_COUNT,
  OCCASION_LABELS,
  TEXT_LIMITS,
  type HeadlineSuggestInput,
  type OccasionType,
} from '@app/shared';
import { env } from '../config/env';
import { HttpError } from '../lib/httpError';
import { logger } from '../lib/logger';
import { GenerationLog } from '../models/GenerationLog';
import type { UserDoc } from '../models/User';
import { findBlockedTerm } from './blocklist';
import { generateJson, geminiConfigured } from './gemini';
import { withQuota } from './quota';

const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: { headlines: { type: 'array', items: { type: 'string' } } },
  required: ['headlines'],
};
const responseSchema = z.object({ headlines: z.array(z.string()) });

/** Asked for in the prompt: 2–6 words fit the poster's headline box at a large size. */
const TARGET_HEADLINE_CHARS = 40;
/**
 * Accepted: Bangla vowel signs count as characters, so natural 5–6 word headlines often run
 * 41–50; the template's text fitting shrinks them to fit.
 */
const MAX_HEADLINE_CHARS = 60;
const BANGLA = /[ঀ-৿]/;
const LATIN = /[A-Za-z]/;

export function buildPrompt(
  occasion: OccasionType,
  example: string | undefined,
  context: NonNullable<HeadlineSuggestInput['context']>,
): string {
  const details = [
    context.organization && `Organization: ${context.organization}`,
    context.location && `Area: ${context.location}`,
    context.name &&
      `Poster published by: ${context.name}${context.designation ? `, ${context.designation}` : ''}`,
    context.leader1Name && `Leader shown on the poster: ${context.leader1Name}`,
  ].filter(Boolean);

  return [
    `Write ${HEADLINE_SUGGESTION_COUNT.max} different headlines in Bangla for a Bangladeshi political poster for this occasion: ${OCCASION_LABELS[occasion]}.`,
    example
      ? `The template's standard headline is "${example}"; offer fresh alternatives in the same spirit.`
      : '',
    details.length
      ? `Details from the user (use only if they fit naturally):\n${details.join('\n')}`
      : '',
    'Rules:',
    `- Bangla script only, no English words, no emojis, no hashtags, no quotation marks.`,
    `- Short: 2 to 6 words, at most ${TARGET_HEADLINE_CHARS} characters each.`,
    '- Respectful and dignified; for mourning, solemn.',
    '- Party-neutral: do not name any political party, leader or slogan unless it appears in the details above.',
    '- No attacks on anyone, no hate, no false claims, no election promises.',
    // Seen in testing: "সুবর্ণজয়ন্তী" (the 50th anniversary, 2021) suggested for a 2026 poster.
    '- Do not mention an anniversary number, jubilee or year; the poster may be used in any year.',
    'Return JSON: {"headlines": ["...", "..."]}.',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Keeps only clean, short Bangla headlines; drops duplicates. */
export function cleanHeadlines(raw: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    const text = item
      .replace(/[“”"'‘’«»]/g, '')
      .replace(/^[\s\-–—•*\d.)]+/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text || !BANGLA.test(text) || LATIN.test(text)) continue;
    if (text.length > Math.min(MAX_HEADLINE_CHARS, TEXT_LIMITS.headline)) continue;
    if (seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result.slice(0, HEADLINE_SUGGESTION_COUNT.max);
}

/**
 * 3–5 headline suggestions for a template's occasion. Uses one unit of the daily headline quota,
 * refunded if Gemini fails or returns nothing usable (503 AI_UNAVAILABLE).
 */
export async function suggestHeadlines(
  user: UserDoc,
  template: { occasionType: OccasionType; defaultHeadline?: string },
  context: NonNullable<HeadlineSuggestInput['context']>,
): Promise<string[]> {
  if (!geminiConfigured()) {
    throw new HttpError(503, 'AI_UNAVAILABLE', 'Headline suggestions are not configured');
  }

  return withQuota(user, 'headlines', async () => {
    const started = performance.now();
    let model = env.GEMINI_VISION_MODEL;
    try {
      const result = await generateJson({
        // The lite model answers reliably in ~3–6 s with good Bangla; 3.8-flash is often busy.
        models: [env.GEMINI_VISION_MODEL, env.GEMINI_MODEL],
        contents: [{ text: buildPrompt(template.occasionType, template.defaultHeadline, context) }],
        schema: RESPONSE_JSON_SCHEMA,
        temperature: 0.9,
        timeoutMs: 7_000,
        budgetMs: 15_000,
        minAttemptMs: 4_000,
      });
      model = result.model;
      const suggestions = cleanHeadlines(responseSchema.parse(result.data).headlines).filter(
        (headline) => !findBlockedTerm(headline),
      );
      if (suggestions.length === 0) throw new Error('No usable headlines in the response');

      void logCall(user, model, performance.now() - started, true);
      return suggestions;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      model = (err as { model?: string }).model ?? model;
      logger.warn({ model, err: message.slice(0, 200) }, 'Headline suggestion failed');
      void logCall(user, model, performance.now() - started, false, message);
      throw new HttpError(503, 'AI_UNAVAILABLE', 'Suggestions are not available right now');
    }
  });
}

function logCall(user: UserDoc, model: string, ms: number, success: boolean, error?: string) {
  return GenerationLog.create({
    userId: user._id,
    stage: 'headline',
    model,
    latencyMs: Math.round(ms),
    success,
    error: error?.slice(0, 500) ?? null,
  }).catch((err: unknown) => logger.error({ err }, 'Could not write GenerationLog'));
}
