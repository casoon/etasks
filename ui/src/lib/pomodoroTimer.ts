// @module:planning
/**
 * Pomodoro timer logic, independent of the mounted view.
 * Call startPomodoroTicker() once from App.svelte; the running state is an end timestamp in the store.
 */

import {
  $pomodoroRunning,
  $pomodoroSeconds,
  $pomodoroSessionMinutes,
  $pomodoroMode,
  $pomodoroSessionCount,
  $pomodoroEndAt,
  $focusTaskId,
} from '../stores/uiStore';
import { $tasks } from '../stores/taskStore';
import { notifyPomodoroComplete } from './notifications';

export const BREAK_DURATION = 5 * 60;

let ticker: ReturnType<typeof setInterval> | null = null;

function remainingSeconds(endAt: number): number {
  return Math.ceil((endAt - Date.now()) / 1000);
}

function finish() {
  $pomodoroRunning.set(false);
  $pomodoroEndAt.set(null);
  if ($pomodoroMode.get() === 'work') {
    $pomodoroSessionCount.set($pomodoroSessionCount.get() + 1);
    const focusId = $focusTaskId.get();
    notifyPomodoroComplete(focusId ? $tasks.get().find(t => t.id === focusId)?.title : undefined);
  } else {
    $pomodoroMode.set('work');
  }
  $pomodoroSeconds.set($pomodoroSessionMinutes.get() * 60);
}

export function tickPomodoro(): void {
  const endAt = $pomodoroEndAt.get();
  if (!$pomodoroRunning.get() || endAt === null) return;
  const remaining = remainingSeconds(endAt);
  if (remaining <= 0) finish();
  else $pomodoroSeconds.set(remaining);
}

export function startPomodoroTicker(): void {
  stopPomodoroTicker();
  ticker = setInterval(tickPomodoro, 1000);
}

export function stopPomodoroTicker(): void {
  if (ticker) {
    clearInterval(ticker);
    ticker = null;
  }
}

export function togglePomodoro(): void {
  if ($pomodoroRunning.get()) {
    const endAt = $pomodoroEndAt.get();
    if (endAt !== null) $pomodoroSeconds.set(Math.max(0, remainingSeconds(endAt)));
    $pomodoroEndAt.set(null);
    $pomodoroRunning.set(false);
  } else {
    $pomodoroEndAt.set(Date.now() + $pomodoroSeconds.get() * 1000);
    $pomodoroRunning.set(true);
  }
}

export function startPomodoroBreak(): void {
  $pomodoroMode.set('break');
  $pomodoroSeconds.set(BREAK_DURATION);
  $pomodoroEndAt.set(Date.now() + BREAK_DURATION * 1000);
  $pomodoroRunning.set(true);
}

export function cancelPomodoro(): void {
  $pomodoroRunning.set(false);
  $pomodoroEndAt.set(null);
  $pomodoroMode.set('work');
  $pomodoroSeconds.set($pomodoroSessionMinutes.get() * 60);
}

/** Changes the session length; ignored while the timer runs. */
export function adjustPomodoroDuration(delta: number): void {
  if ($pomodoroRunning.get()) return;
  const next = Math.min(90, Math.max(5, $pomodoroSessionMinutes.get() + delta));
  $pomodoroSessionMinutes.set(next);
  if ($pomodoroMode.get() === 'work') $pomodoroSeconds.set(next * 60);
}
