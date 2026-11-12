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
vi.mock('./notifications', () => ({ notifyPomodoroComplete: vi.fn() }));

import { $tasks, toggleTask, updateTask } from '../stores/taskStore';
import { $timeEntries, $activeEntry, startTaskTimer } from '../stores/timerStore';
import { $focusTaskId, $pomodoroSessionMinutes, $pomodoroMode } from '../stores/uiStore';
import { togglePomodoro, tickPomodoro } from './pomodoroTimer';

const now = '2026-03-10T10:00:00.000Z';
const task = (id: string) => ({ id, title: id, status: 'todo', tags: [], createdAt: now, updatedAt: now }) as never;

beforeEach(() => {
  storage.clear();
  storage.set('etasks:tasks', [task('a'), task('b')]);
  $tasks.set([task('a'), task('b')]);
  $timeEntries.set([]);
  $pomodoroMode.set('work');
  $pomodoroSessionMinutes.set(25);
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 2, 10, 12, 0, 0));
});
afterEach(() => vi.useRealTimers());

describe('timer store', () => {
  it('refreshes tasks and entries after switching the timer from A to B', () => {
    startTaskTimer('a');
    vi.advanceTimersByTime(30_000);
    startTaskTimer('b');
    expect($tasks.get().find((t) => t.id === 'a')?.trackedSeconds).toBe(30);
    expect($timeEntries.get().filter((e) => !e.endAt).map((e) => e.taskId)).toEqual(['b']);
  });

  it('stops the timer when its task is marked done', () => {
    startTaskTimer('a');
    vi.advanceTimersByTime(10_000);
    toggleTask('a');
    expect($activeEntry.get()).toBeNull();
    expect($tasks.get().find((t) => t.id === 'a')?.trackedSeconds).toBe(10);
  });

  it('stops the timer when a task is set done via updateTask', () => {
    startTaskTimer('a');
    updateTask('a', { status: 'done' });
    expect($activeEntry.get()).toBeNull();
  });

  it('keeps the timer running when another task is marked done', () => {
    startTaskTimer('a');
    toggleTask('b');
    expect($activeEntry.get()?.taskId).toBe('a');
  });
});

describe('pomodoro session as time entry', () => {
  function runSession() {
    togglePomodoro();
    vi.advanceTimersByTime(25 * 60_000 + 1000);
    tickPomodoro();
  }

  it('records the finished work session for the focus task', () => {
    $focusTaskId.set('a');
    runSession();
    const [entry] = $timeEntries.get();
    expect(entry.taskId).toBe('a');
    expect(entry.durationSeconds).toBe(25 * 60);
  });

  it('does not double count while a timer runs on the same task', () => {
    $focusTaskId.set('a');
    startTaskTimer('a');
    runSession();
    expect($timeEntries.get()).toHaveLength(1);
    expect($activeEntry.get()?.taskId).toBe('a');
  });

  it('records nothing without a focus task', () => {
    $focusTaskId.set(null);
    runSession();
    expect($timeEntries.get()).toHaveLength(0);
  });
});
