import { describe, it, expect } from 'vitest';
import { formatLocalDate, formatDisplayDate } from '../utils/dateUtils.js';

describe('formatLocalDate Utility', () => {
  it('formats dates with leading zeros for month and day', () => {
    const testDate = new Date(2026, 4, 9, 14, 30); // May 9, 2026
    expect(formatLocalDate(testDate)).toBe('2026-05-09');
  });

  it('formats dates at local midnight correctly', () => {
    const testDate = new Date(2026, 9, 27, 0, 0, 0); // Oct 27, 2026 00:00:00
    expect(formatLocalDate(testDate)).toBe('2026-10-27');
  });

  it('formats dates late at night without shifting day', () => {
    const testDate = new Date(2026, 9, 27, 23, 59, 59); // Oct 27, 2026 23:59:59
    expect(formatLocalDate(testDate)).toBe('2026-10-27');
  });

  it('formats dates in early morning without shifting to previous day', () => {
    // 01:15 AM
    const testDate = new Date(2026, 9, 27, 1, 15, 0);
    expect(formatLocalDate(testDate)).toBe('2026-10-27');
  });

  it('handles year rollover correctly', () => {
    const testDate = new Date(2026, 11, 31, 23, 59); // Dec 31, 2026
    expect(formatLocalDate(testDate)).toBe('2026-12-31');
    const newYear = new Date(2027, 0, 1, 0, 1); // Jan 1, 2027
    expect(formatLocalDate(newYear)).toBe('2027-01-01');
  });

  it('returns empty string for invalid dates', () => {
    expect(formatLocalDate('invalid-date')).toBe('');
  });

  it('formats display dates correctly using local midnight', () => {
    const display = formatDisplayDate('2026-10-27');
    expect(display).toContain('Oct 27, 2026');
    expect(display).toContain('Tue');
  });
});
