import { describe, it, expect } from 'vitest';
import {
  addDaysToKey,
  isoWeekNumber,
  formatHm,
  diffDays,
  formatDateDe,
  toDateKey,
  toDateKeyFromIso,
  getWeekStart,
  formatDuration,
  formatTrackedTime,
  formatElapsed,
  daysSince,
  isToday,
} from './dateUtils';

describe('toDateKey', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(toDateKey(new Date(2026, 2, 15, 10, 0))).toBe('2026-03-15');
  });

  it('pads month and day', () => {
    expect(toDateKey(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05');
  });

  it('uses the local day just after midnight', () => {
    expect(toDateKey(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05');
  });

  it('uses the local day just before midnight', () => {
    expect(toDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('getWeekStart', () => {
  // Use noon to avoid local-midnight ↔ UTC-previous-day conversion issues
  it('returns Monday of the same week for a Wednesday', () => {
    const wed = new Date('2026-03-25T12:00:00');
    expect(getWeekStart(wed)).toBe('2026-03-23');
  });

  it('returns Monday itself shortly after local midnight', () => {
    expect(getWeekStart(new Date(2026, 2, 23, 0, 30))).toBe('2026-03-23');
  });

  it('returns Monday itself when given a Monday', () => {
    const mon = new Date('2026-03-23T12:00:00');
    expect(getWeekStart(mon)).toBe('2026-03-23');
  });

  it('returns the previous Monday for a Sunday', () => {
    const sun = new Date('2026-03-29T12:00:00');
    expect(getWeekStart(sun)).toBe('2026-03-23');
  });
});

describe('toDateKeyFromIso', () => {
  it('accepts date keys unchanged', () => {
    expect(toDateKeyFromIso('2026-03-23')).toBe('2026-03-23');
  });

  it('normalizes ISO timestamps to date keys', () => {
    expect(toDateKeyFromIso(new Date(2026, 2, 23, 0, 15).toISOString())).toBe('2026-03-23');
  });

  it('returns null for invalid values', () => {
    expect(toDateKeyFromIso('not-a-date')).toBeNull();
  });
});

describe('diffDays and daysSince', () => {
  it('computes whole day differences between dates', () => {
    expect(diffDays('2026-03-20', '2026-03-23')).toBe(3);
  });

  it('handles ISO timestamps and date keys together', () => {
    expect(diffDays('2026-03-20T08:00:00.000Z', '2026-03-23')).toBe(3);
  });

  it('returns null for invalid input', () => {
    expect(diffDays('bad', '2026-03-23')).toBeNull();
  });

  it('uses today-like reference values for age calculations', () => {
    expect(daysSince('2026-03-20', '2026-03-23')).toBe(3);
  });
});

describe('isToday', () => {
  it('matches date keys and ISO timestamps against the same day', () => {
    expect(isToday('2026-03-23', '2026-03-23')).toBe(true);
    expect(isToday(new Date(2026, 2, 23, 9, 15).toISOString(), '2026-03-23')).toBe(true);
  });

  it('returns false for other days', () => {
    expect(isToday(new Date(2026, 2, 22, 23, 59).toISOString(), '2026-03-23')).toBe(false);
  });
});

describe('formatDuration', () => {
  it('formats minutes below 60', () => {
    expect(formatDuration(30)).toBe('30m');
    expect(formatDuration(1)).toBe('1m');
  });

  it('formats exactly 60 minutes', () => {
    expect(formatDuration(60)).toBe('1h');
  });

  it('formats hours with remaining minutes', () => {
    expect(formatDuration(90)).toBe('1h 30m');
    expect(formatDuration(135)).toBe('2h 15m');
  });

  it('formats whole hours without minutes suffix', () => {
    expect(formatDuration(120)).toBe('2h');
  });
});

describe('formatTrackedTime', () => {
  it('shows seconds for under a minute', () => {
    expect(formatTrackedTime(0)).toBe('0s');
    expect(formatTrackedTime(45)).toBe('45s');
    expect(formatTrackedTime(59)).toBe('59s');
  });

  it('shows minutes for under an hour', () => {
    expect(formatTrackedTime(60)).toBe('1m');
    expect(formatTrackedTime(90)).toBe('1m');
    expect(formatTrackedTime(3599)).toBe('59m');
  });

  it('shows hours without minutes for whole hours', () => {
    expect(formatTrackedTime(3600)).toBe('1h');
    expect(formatTrackedTime(7200)).toBe('2h');
  });

  it('shows hours and minutes', () => {
    expect(formatTrackedTime(3660)).toBe('1h 1m');
    expect(formatTrackedTime(5400)).toBe('1h 30m');
  });
});

describe('formatElapsed', () => {
  it('returns a formatted duration from a past ISO timestamp', () => {
    const thirtySecondsAgo = new Date(Date.now() - 30_000).toISOString();
    expect(formatElapsed(thirtySecondsAgo)).toBe('30s');
  });

  it('returns minutes for timestamps over a minute ago', () => {
    const twoMinutesAgo = new Date(Date.now() - 120_000).toISOString();
    expect(formatElapsed(twoMinutesAgo)).toBe('2m');
  });
});

describe('formatDateDe', () => {
  it('formats ISO dates as dd.mm.yyyy and leaves other values alone', () => {
    expect(formatDateDe('2026-11-12')).toBe('12.11.2026');
    expect(formatDateDe('2026-11-12T10:00:00Z')).toBe('12.11.2026');
    expect(formatDateDe('')).toBe('');
    expect(formatDateDe('kein Datum')).toBe('kein Datum');
  });
});

describe('addDaysToKey / isoWeekNumber / formatHm', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDaysToKey('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDaysToKey('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('computes the ISO week', () => {
    expect(isoWeekNumber('2026-11-12')).toBe(46);
    expect(isoWeekNumber('2026-01-01')).toBe(1);
    expect(isoWeekNumber('2027-01-01')).toBe(53);
  });
  it('formats minutes like the design', () => {
    expect(formatHm(315)).toBe('5 h 15');
    expect(formatHm(120)).toBe('2 h');
    expect(formatHm(30)).toBe('30 min');
    expect(formatHm(65)).toBe('1 h 05');
  });
});
