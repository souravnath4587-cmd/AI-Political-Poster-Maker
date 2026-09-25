import { describe, expect, it } from 'vitest';
import { HttpError } from '../lib/httpError';
import { assertAllowedText, findBlockedTerm, normalizeForMatch } from './blocklist';

describe('findBlockedTerm', () => {
  it.each([
    ['exact Bangla', 'ওদের হত্যা কর'],
    ['English, any case', 'Join Hizb-ut-Tahrir today'],
    ['zero-width characters hidden inside', 'হত্যা​ কর'],
    ['an organization name spaced out', 'হি য বু ত  তা হ রী র'],
    ['punctuation in between', 'জবাই...কর!!'],
  ])('catches %s', (_label, text) => {
    expect(findBlockedTerm(text)).not.toBeNull();
  });

  it.each([
    'মহান বিজয় দিবস',
    'স্বাধীনতা সংগ্রামের সকল বীর শহীদের প্রতি বিনম্র শ্রদ্ধাঞ্জলি',
    'গভীর শোক',
    'সাংগঠনিক সম্পাদক, যুব সংগঠন',
    'Ansar Uddin', // a name that merely starts like a listed group
    // Mourning language uses the same words as a statement, not a command:
    'তাঁকে নৃশংসভাবে হত্যা করা হয়েছে',
    'হত্যা করার বিচার চাই',
    'খতমে কোরআন ও দোয়া মাহফিল',
  ])('allows ordinary poster text: %s', (text) => {
    expect(findBlockedTerm(text)).toBeNull();
  });

  it('normalizes case, spacing and invisible characters', () => {
    expect(normalizeForMatch('  Hello,‍   WORLD!  ')).toBe('hello world');
  });
});

describe('assertAllowedText', () => {
  it('names the field, not the term', () => {
    try {
      assertAllowedText({ name: 'মোঃ করিম', message: 'ওদের খতম কর' });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect(err).toMatchObject({
        status: 400,
        code: 'BLOCKED_CONTENT',
        details: { field: 'message' },
      });
    }
  });

  it('passes clean text and empty fields', () => {
    expect(() => assertAllowedText({ name: 'মোঃ করিম', headline: '' })).not.toThrow();
  });
});
