import { describe, expect, it } from 'vitest';
import { formatClock, taskCapacityMinutes, trackedSecondsByProject, trackedSecondsOn } from './dayStats';

const at = (h: number, m = 0) => new Date(2026, 10, 12, h, m).toISOString();
const now = new Date(2026, 10, 12, 12, 0).getTime();

describe('dayStats', () => {
  const entries = [
    { startAt: at(8), endAt: at(9), projectId: 'p1', durationSeconds: 3600 },
    { startAt: at(9, 30), endAt: at(10), projectId: 'p2', durationSeconds: 1800 },
    { startAt: at(11, 30), endAt: null, projectId: 'p1' },
    { startAt: new Date(2026, 10, 11, 8).toISOString(), endAt: new Date(2026, 10, 11, 9).toISOString(), projectId: 'p1', durationSeconds: 3600 },
  ];

  it('sums the local day including the running entry', () => {
    expect(trackedSecondsOn(entries, '2026-11-12', now)).toBe(3600 + 1800 + 1800);
  });

  it('groups by project and ignores other days', () => {
    const map = trackedSecondsByProject(entries, '2026-11-12', now);
    expect(map.get('p1')).toBe(3600 + 1800);
    expect(map.get('p2')).toBe(1800);
  });

  it('computes capacity and clock', () => {
    expect(taskCapacityMinutes(30)).toBe(510);
    expect(taskCapacityMinutes(9999)).toBe(0);
    expect(formatClock(2538)).toBe('0:42:18');
  });
});
