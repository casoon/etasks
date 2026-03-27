import { atom, computed } from 'nanostores';
import type { TimeEntry } from '../domain/types';
import { loadTimeEntries, loadTasks } from '../lib/db';
import { startTimer as svcStart, stopTimer as svcStop } from '../lib/timerService';
import { $tasks } from './taskStore';

export const $timeEntries = atom<TimeEntry[]>([]);

export const $activeEntry = computed($timeEntries, (entries) =>
  entries.find(e => !e.endAt) ?? null
);

export const $activeTaskId = computed($activeEntry, (entry) => entry?.taskId ?? null);

export function initTimeEntries(): void {
  $timeEntries.set(loadTimeEntries());
}

export function startTaskTimer(taskId: string): void {
  const task = $tasks.get().find(t => t.id === taskId);
  svcStart(taskId, task?.projectId);
  $timeEntries.set(loadTimeEntries());
}

export function stopActiveTimer(): void {
  const active = $activeEntry.get();
  if (!active) return;
  svcStop(active.id);
  // Reload both entries and tasks (trackedSeconds got updated in svcStop)
  $timeEntries.set(loadTimeEntries());
  $tasks.set(loadTasks());
}

export function getTaskTrackedSeconds(taskId: string): number {
  return $timeEntries.get()
    .filter(e => e.taskId === taskId && e.endAt)
    .reduce((sum, e) => sum + (e.durationMinutes ?? 0) * 60, 0);
}
