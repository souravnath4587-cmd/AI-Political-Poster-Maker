import { describe, expect, it } from 'vitest';
import { formatBdPhoneLocal, normalizeBdPhone, otpCodeSchema, toAsciiDigits } from './auth';

describe('normalizeBdPhone', () => {
  it.each([
    ['01712345678', '+8801712345678'],
    ['+8801712345678', '+8801712345678'],
    ['8801712345678', '+8801712345678'],
    ['1712345678', '+8801712345678'],
    ['017-1234 5678', '+8801712345678'],
    ['০১৭১২৩৪৫৬৭৮', '+8801712345678'],
    ['+৮৮০১৯৯৯০০০০০১', '+8801999000001'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeBdPhone(input)).toBe(expected);
  });

  it.each(['', '0171234567', '017123456789', '01212345678', '+14155550100', 'abc'])(
    'rejects %j',
    (input) => {
      expect(normalizeBdPhone(input)).toBeNull();
    },
  );
});

describe('helpers', () => {
  it('converts Bangla digits', () => {
    expect(toAsciiDigits('কোড ১২৩৪৫৬')).toBe('কোড 123456');
  });

  it('formats numbers the local way', () => {
    expect(formatBdPhoneLocal('+8801712345678')).toBe('01712345678');
  });

  it('accepts 6-digit codes in either script', () => {
    expect(otpCodeSchema.parse('১২৩ ৪৫৬')).toBe('123456');
    expect(otpCodeSchema.safeParse('12345').success).toBe(false);
  });
});
