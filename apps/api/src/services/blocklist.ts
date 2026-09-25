import { TEXT_FIELDS, type TextField } from '@app/shared';
import { HttpError } from '../lib/httpError';

/**
 * Minimum guardrail (project-scope R1): terms that must not appear on a poster.
 *
 * This is a small STARTING list, deliberately limited to clear violent incitement and militant
 * organizations banned in Bangladesh. It is not a political filter: legal parties and their
 * leaders are not listed. Deciding what else belongs here is the owner's call (project-scope,
 * open question 2); it is a known limitation documented in the README.
 */
/** Militant organizations banned in Bangladesh (Bangla and English/transliterated names). */
const BLOCKED_ORGANIZATIONS = [
  'জামাআতুল মুজাহিদীন',
  'জামায়াতুল মুজাহিদীন',
  'jamaatul mujahideen',
  'হরকাতুল জিহাদ',
  'harkatul jihad',
  'হিযবুত তাহরীর',
  'হিজবুত তাহরীর',
  'hizb ut tahrir',
  'আনসারুল্লাহ বাংলা টিম',
  'ansarullah bangla team',
  'আনসার আল ইসলাম',
  'ansar al islam',
  'শাহাদাত-ই-আল হিকমা',
];

/**
 * Violent incitement, as commands. Matched as whole words only: "হত্যা কর" (kill!) must not
 * match "হত্যা করা হয়েছে" (was killed), which a mourning poster may well say.
 */
const BLOCKED_PHRASES = [
  'জবাই কর',
  'কতল কর',
  'খতম কর',
  'হত্যা কর',
  'মেরে ফেল',
  'জ্বালিয়ে দাও',
  'kill them',
];

/** Characters used to hide words: zero-width space/joiners, BOM, soft hyphen. */
const INVISIBLE = new RegExp('[\u200B-\u200D\u2060\uFEFF\u00AD]', 'g');

/** Lowercase, NFC, invisible characters removed, punctuation and runs of space → one space. */
export function normalizeForMatch(text: string): string {
  return text
    .normalize('NFC')
    .replace(INVISIBLE, '')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, ' ')
    .trim();
}

/** Same, without any spaces: catches "হ ত্যা কর" style spacing tricks. */
const compact = (text: string) => normalizeForMatch(text).replace(/ /g, '');

const TERMS = [
  // Long, specific names: also caught when spaced out letter by letter.
  ...BLOCKED_ORGANIZATIONS.map((term) => ({
    spaced: normalizeForMatch(term),
    compact: compact(term),
  })),
  // Short phrases: removing spaces would join neighboring words and cause false matches.
  ...BLOCKED_PHRASES.map((term) => ({ spaced: normalizeForMatch(term), compact: null })),
];

/** The first blocked term found in the text, or null. */
export function findBlockedTerm(text: string): string | null {
  // Padded with spaces so terms only match whole words.
  const spaced = ` ${normalizeForMatch(text)} `;
  const tight = spaced.replace(/ /g, '');
  const hit = TERMS.find(
    (t) => spaced.includes(` ${t.spaced} `) || (t.compact !== null && tight.includes(t.compact)),
  );
  return hit ? hit.spaced : null;
}

/** Throws 400 BLOCKED_CONTENT naming the field (not the term) if any text field is blocked. */
export function assertAllowedText(text: Partial<Record<TextField, string | undefined>>): void {
  for (const field of TEXT_FIELDS) {
    const value = text[field];
    if (value && findBlockedTerm(value)) {
      throw new HttpError(400, 'BLOCKED_CONTENT', 'Text contains content that is not allowed', {
        field,
      });
    }
  }
}
