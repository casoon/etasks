// @core
import { atom } from 'nanostores';
import type { NavItem, TodayPhase } from '../domain/types';

export const $navItem = atom<NavItem>('today');
export const $todayPhase = atom<TodayPhase>('work');
/** Pomodoro/focus surface inside „Heute · Arbeiten“. */
export const $focusOpen = atom<boolean>(false);
export const $focusTaskId = atom<string | null>(null);
export const $pomodoroRunning = atom<boolean>(false);
export const $pomodoroSeconds = atom<number>(25 * 60);
/** Wall-clock end (ms) of the running session; null while paused/stopped. */
export const $pomodoroEndAt = atom<number | null>(null);
export const $pomodoroSessionMinutes = atom<number>(25);
export const $pomodoroMode = atom<'work' | 'break'>('work');
export const $pomodoroSessionCount = atom<number>(0);
export const $showShutdown = atom<boolean>(false);
export const $energyCheckPending = atom<boolean>(false);
export const $quickAddOpen = atom<boolean>(false);
export const $quickAddProjectId = atom<string | null>(null);

export function openToday(phase: TodayPhase): void {
  $todayPhase.set(phase);
  $navItem.set('today');
}

export function openFocus(taskId?: string): void {
  if (taskId) $focusTaskId.set(taskId);
  $focusOpen.set(true);
  openToday('work');
}
