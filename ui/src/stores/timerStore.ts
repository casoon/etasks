// @module:time-tracking
import { atom, computed } from 'nanostores';
import type { TimeEntry } from '../domain/types';
import { entrySeconds } from '../domain/dateUtils';
import { loadTimeEntries, loadTasks, deleteTimeEntry } from '../lib/db';
import {
  startTimer as svcStart,
  stopTimer as svcStop,
  addFinishedEntry,
  editFinishedEntry,
  removeEntry,
} from '../lib/timerService';
import { $tasks } from './taskStore';
import { $bridgeTimeEntries } from './coreBridge';

export const $timeEntries = atom<TimeEntry[]>([]);
$timeEntries.subscribe(val => $bridgeTimeEntries.set(val as TimeEntry[]));

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
  // Reload both: starting stops a running timer on another task and updates its trackedSeconds
  $timeEntries.set(loadTimeEntries());
  $tasks.set(loadTasks());
}

/** Stops the running timer; `endAt` backdates the end (forgotten timer). */
export function stopActiveTimer(endAt?: string): void {
  const active = $activeEntry.get();
  if (!active) return;
  svcStop(active.id, endAt);
  // Reload both entries and tasks (trackedSeconds got updated in svcStop)
  $timeEntries.set(loadTimeEntries());
  $tasks.set(loadTasks());
}

function reloadAfterEntryChange(): void {
  $timeEntries.set(loadTimeEntries());
  $tasks.set(loadTasks());
}

export function discardActiveTimer(): void {
  const active = $activeEntry.get();
  if (!active) return;
  removeEntry(active.id);
  reloadAfterEntryChange();
}

export function addTimeEntry(taskId: string, startAt: string, endAt: string): void {
  const task = $tasks.get().find(t => t.id === taskId);
  addFinishedEntry(taskId, task?.projectId, startAt, endAt);
  reloadAfterEntryChange();
}

export function updateTimeEntry(id: string, taskId: string, startAt: string, endAt: string): void {
  const task = $tasks.get().find(t => t.id === taskId);
  editFinishedEntry(id, { taskId, projectId: task?.projectId, startAt, endAt });
  reloadAfterEntryChange();
}

export function deleteTimeEntryById(id: string): void {
  removeEntry(id);
  reloadAfterEntryChange();
}

// Marking a task done (any path) stops a timer running on it.
$tasks.subscribe(tasks => {
  const active = $activeEntry.get();
  if (active && tasks.find(t => t.id === active.taskId)?.status === 'done') stopActiveTimer();
});

export function removeTimeEntriesWhere(match: (entry: TimeEntry) => boolean): void {
  for (const entry of $timeEntries.get().filter(match)) {
    $timeEntries.set(deleteTimeEntry(entry.id));
  }
}

export function getTaskTrackedSeconds(taskId: string): number {
  return $timeEntries.get()
    .filter(e => e.taskId === taskId && e.endAt)
    .reduce((sum, e) => sum + entrySeconds(e), 0);
}