import { describe, expect, it } from 'vitest';
import { dhakaDate, nextDhakaMidnight } from './quota';

describe('dhakaDate', () => {
  it('uses the Dhaka calendar day, which starts at 18:00 UTC', () => {
    expect(dhakaDate(new Date('2026-09-25T17:59:59.999Z'))).toBe('2026-09-25');
    expect(dhakaDate(new Date('2026-09-25T18:00:00.000Z'))).toBe('2026-09-26');
    // 05:59 in Dhaka is still the same day there, though it's the previous day in UTC.
    expect(dhakaDate(new Date('2026-09-25T23:59:00.000Z'))).toBe('2026-09-26');
  });

  it('handles month and year ends', () => {
    expect(dhakaDate(new Date('2026-12-31T18:30:00Z'))).toBe('2027-01-01');
    expect(dhakaDate(new Date('2026-02-28T18:00:00Z'))).toBe('2026-03-01');
  });
});

describe('nextDhakaMidnight', () => {
  it('is 18:00 UTC of the current Dhaka day', () => {
    expect(nextDhakaMidnight(new Date('2026-09-25T10:00:00Z')).toISOString()).toBe(
      '2026-09-25T18:00:00.000Z',
    );
  });

  it('moves to the following day exactly at midnight', () => {
    expect(nextDhakaMidnight(new Date('2026-09-25T18:00:00Z')).toISOString()).toBe(
      '2026-09-26T18:00:00.000Z',
    );
  });
});
