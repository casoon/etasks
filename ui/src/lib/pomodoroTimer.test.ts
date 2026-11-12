import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./notifications', () => ({ notifyPomodoroComplete: vi.fn(), notify: vi.fn() }));

import {
  $pomodoroRunning,
  $pomodoroSeconds,
  $pomodoroSessionMinutes,
  $pomodoroMode,
  $pomodoroSessionCount,
  $pomodoroEndAt,
} from '../stores/uiStore';
import { notifyPomodoroComplete } from './notifications';
import {
  startPomodoroTicker,
  stopPomodoroTicker,
  togglePomodoro,
  startPomodoroBreak,
  cancelPomodoro,
  adjustPomodoroDuration,
} from './pomodoroTimer';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-05T10:00:00'));
  vi.mocked(notifyPomodoroComplete).mockClear();
  $pomodoroRunning.set(false);
  $pomodoroEndAt.set(null);
  $pomodoroMode.set('work');
  $pomodoroSessionMinutes.set(25);
  $pomodoroSeconds.set(25 * 60);
  $pomodoroSessionCount.set(0);
  startPomodoroTicker();
});

afterEach(() => {
  stopPomodoroTicker();
  vi.useRealTimers();
});

describe('pomodoroTimer', () => {
  it('counts down against the end timestamp without any view', () => {
    togglePomodoro();
    vi.advanceTimersByTime(8000);
    expect($pomodoroSeconds.get()).toBe(25 * 60 - 8);
  });

  it('pause keeps the remaining time, resume continues from it', () => {
    togglePomodoro();
    vi.advanceTimersByTime(10_000);
    togglePomodoro();
    vi.advanceTimersByTime(60_000);
    expect($pomodoroSeconds.get()).toBe(25 * 60 - 10);
    togglePomodoro();
    vi.advanceTimersByTime(5000);
    expect($pomodoroSeconds.get()).toBe(25 * 60 - 15);
  });

  it('finishes a work session: counts, notifies, resets to session length', () => {
    togglePomodoro();
    vi.advanceTimersByTime(25 * 60 * 1000);
    expect($pomodoroRunning.get()).toBe(false);
    expect($pomodoroSessionCount.get()).toBe(1);
    expect(notifyPomodoroComplete).toHaveBeenCalledTimes(1);
    expect($pomodoroSeconds.get()).toBe(25 * 60);
  });

  it('start after a finished session starts a fresh one', () => {
    togglePomodoro();
    vi.advanceTimersByTime(25 * 60 * 1000);
    togglePomodoro();
    vi.advanceTimersByTime(3000);
    expect($pomodoroRunning.get()).toBe(true);
    expect($pomodoroSessionCount.get()).toBe(1);
    expect($pomodoroSeconds.get()).toBe(25 * 60 - 3);
  });

  it('break ends in work mode without counting a session', () => {
    startPomodoroBreak();
    vi.advanceTimersByTime(5 * 60 * 1000);
    expect($pomodoroMode.get()).toBe('work');
    expect($pomodoroRunning.get()).toBe(false);
    expect($pomodoroSessionCount.get()).toBe(0);
    expect($pomodoroSeconds.get()).toBe(25 * 60);
  });

  it('cancel resets to the session length', () => {
    togglePomodoro();
    vi.advanceTimersByTime(30_000);
    cancelPomodoro();
    expect($pomodoroRunning.get()).toBe(false);
    expect($pomodoroSeconds.get()).toBe(25 * 60);
  });

  it('adjusts the session length only while stopped', () => {
    adjustPomodoroDuration(5);
    expect($pomodoroSessionMinutes.get()).toBe(30);
    expect($pomodoroSeconds.get()).toBe(30 * 60);
    togglePomodoro();
    adjustPomodoroDuration(5);
    expect($pomodoroSessionMinutes.get()).toBe(30);
  });
});
