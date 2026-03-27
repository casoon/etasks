import { describe, it, expect } from 'vitest';
import {
  toDateKey,
  getWeekStart,
  formatDuration,
  formatTrackedTime,
  formatElapsed,
} from './dateUtils';

describe('toDateKey', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(toDateKey(new Date('2026-03-15T10:00:00Z'))).toBe('2026-03-15');
  });

  it('pads month and day', () => {
    expect(toDateKey(new Date('2026-01-05T00:00:00Z'))).toBe('2026-01-05');
  });
});

describe('getWeekStart', () => {
  // Use noon to avoid local-midnight ↔ UTC-previous-day conversion issues
  it('returns Monday of the same week for a Wednesday', () => {
    const wed = new Date('2026-03-25T12:00:00');
    expect(getWeekStart(wed)).toBe('2026-03-23');
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
