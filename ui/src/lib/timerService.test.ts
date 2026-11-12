import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, unknown>();
vi.mock('./storage', () => ({
  KEYS: new Proxy({}, { get: (_t, k) => `etasks:${String(k)}` }),
  storageGet: (key: string) => storage.get(key) ?? null,
  storageSet: (key: string, value: unknown) => void storage.set(key, value),
  reportDbWriteError: () => {},
}));
vi.mock('./platform', () => ({ isTauriAvailable: () => false, isMac: () => true }));
vi.mock('@casoon/origin-client', () => ({ command: vi.fn() }));

import { entrySeconds } from '../domain/dateUtils';
import { loadTasks, loadTimeEntries } from './db';
import {
  startTimer, stopTimer, addFinishedEntry, editFinishedEntry, removeEntry, isStaleEntry, sumTrackedSeconds,
} from './timerService';

const now = '2026-03-10T10:00:00.000Z';
const task = (id: string) => ({ id, title: id, status: 'todo', tags: [], createdAt: now, updatedAt: now });
const trackedOf = (id: string) => loadTasks().find((t) => t.id === id)?.trackedSeconds;

beforeEach(() => {
  storage.clear();
  storage.set('etasks:tasks', [task('a'), task('b')]);
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 2, 10, 12, 0, 0));
});
afterEach(() => vi.useRealTimers());

describe('sub-minute precision', () => {
  it('stores a 3 second entry as seconds and counts it on the task', () => {
    const e = startTimer('a');
    vi.advanceTimersByTime(3000);
    const stopped = stopTimer(e.id)!;
    expect(stopped.durationSeconds).toBe(3);
    expect(stopped.durationMinutes).toBe(0);
    expect(trackedOf('a')).toBe(3);
  });

  it('sums many short sessions instead of rounding each to zero', () => {
    for (let i = 0; i < 4; i++) {
      const e = startTimer('a');
      vi.advanceTimersByTime(20_000);
      stopTimer(e.id);
    }
    expect(sumTrackedSeconds('a')).toBe(80);
    expect(trackedOf('a')).toBe(80);
  });

  it('falls back to minutes for entries without durationSeconds', () => {
    expect(entrySeconds({ durationMinutes: 5 })).toBe(300);
    expect(entrySeconds({ durationMinutes: 5, durationSeconds: 301 })).toBe(301);
    expect(entrySeconds({ durationMinutes: null })).toBe(0);
  });

  it('switching the timer from A to B stops A and keeps its seconds', () => {
    const first = startTimer('a');
    vi.advanceTimersByTime(45_000);
    startTimer('b');
    expect(loadTimeEntries().find((e) => e.id === first.id)?.durationSeconds).toBe(45);
    expect(trackedOf('a')).toBe(45);
    expect(loadTimeEntries().filter((e) => !e.endAt)).toHaveLength(1);
  });
});

describe('editing and stale timers', () => {
  it('stops at a backdated time', () => {
    const e = startTimer('a');
    vi.advanceTimersByTime(16 * 3600_000);
    const end = new Date(new Date(e.startAt).getTime() + 90 * 60_000).toISOString();
    expect(stopTimer(e.id, end)!.durationSeconds).toBe(5400);
  });

  it('adds, edits (also moving between tasks) and removes entries with task totals', () => {
    const e = addFinishedEntry('a', undefined, '2026-03-10T08:00:00.000Z', '2026-03-10T09:00:00.000Z');
    expect(trackedOf('a')).toBe(3600);
    editFinishedEntry(e.id, { taskId: 'b', startAt: '2026-03-10T08:00:00.000Z', endAt: '2026-03-10T08:30:00.000Z' });
    expect(trackedOf('a')).toBe(0);
    expect(trackedOf('b')).toBe(1800);
    removeEntry(e.id);
    expect(trackedOf('b')).toBe(0);
    expect(loadTimeEntries()).toHaveLength(0);
  });

  it('flags running entries older than 12 hours or from an earlier day', () => {
    const entry = (startAt: Date) => ({ id: 'x', taskId: 'a', startAt: startAt.toISOString(), isRunning: true, updatedAt: '' });
    expect(isStaleEntry(entry(new Date(2026, 2, 10, 11, 0)))).toBe(false);
    expect(isStaleEntry(entry(new Date(2026, 2, 9, 23, 0)))).toBe(true);
    vi.setSystemTime(new Date(2026, 2, 10, 23, 59));
    expect(isStaleEntry(entry(new Date(2026, 2, 10, 10, 0)))).toBe(true);
  });
});
