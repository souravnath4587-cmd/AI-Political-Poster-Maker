import { z } from 'zod';
import { TEXT_LIMITS } from './poster';

export const HEADLINE_SUGGESTION_COUNT = { min: 3, max: 5 } as const;

const contextText = (max: number) => z.string().trim().max(max).optional();

/** POST /api/headlines/suggest */
export const headlineSuggestSchema = z.object({
  templateId: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id'),
  /** What the user has typed so far; helps tailor the suggestions. All optional. */
  context: z
    .object({
      name: contextText(TEXT_LIMITS.name),
      designation: contextText(TEXT_LIMITS.designation),
      organization: contextText(TEXT_LIMITS.organization),
      location: contextText(TEXT_LIMITS.location),
      leader1Name: contextText(TEXT_LIMITS.leader1Name),
    })
    .default({}),
});
export type HeadlineSuggestInput = z.input<typeof headlineSuggestSchema>;

export interface HeadlineSuggestResponse {
  suggestions: string[];
  /** Suggestion requests left today; null = unlimited. */
  remaining: number | null;
}
