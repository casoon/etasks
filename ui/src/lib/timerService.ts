// @module:time-tracking
import type { TimeEntry } from '../domain/types';
import { entrySeconds, toDateKeyFromIso, today } from '../domain/dateUtils';
import { loadTimeEntries, upsertTimeEntry, deleteTimeEntry, loadTasks, upsertTask } from './db';
export { formatTrackedTime, formatElapsed } from '../domain/dateUtils';

export function secondsBetween(startAt: string, endAt: string): number {
  return Math.max(0, Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 1000));
}

function withDuration(entry: TimeEntry, startAt: string, endAt: string): TimeEntry {
  const durationSeconds = secondsBetween(startAt, endAt);
  return {
    ...entry,
    startAt,
    endAt,
    durationSeconds,
    durationMinutes: Math.round(durationSeconds / 60),
    isRunning: false,
    updatedAt: new Date().toISOString(),
  };
}

export function startTimer(taskId: string, projectId?: string): TimeEntry {
  // Laufenden Timer stoppen falls vorhanden
  const running = getActiveEntry();
  if (running) stopTimer(running.id);

  const entry: TimeEntry = {
    id: crypto.randomUUID(),
    taskId,
    projectId,
    startAt: new Date().toISOString(),
    endAt: null,
    durationMinutes: null,
    durationSeconds: null,
    isRunning: true,
    updatedAt: new Date().toISOString(),
  };
  upsertTimeEntry(entry);
  return entry;
}

/** Stoppt den Eintrag; `endAt` erlaubt das Nachtragen eines früheren Endes (verwaister Timer). */
export function stopTimer(entryId: string, endAt: string = new Date().toISOString()): TimeEntry | null {
  const entry = loadTimeEntries().find(e => e.id === entryId);
  if (!entry || entry.endAt) return null;

  const updated = withDuration(entry, entry.startAt, endAt);
  upsertTimeEntry(updated);

  // trackedSeconds auf Task aktualisieren
  updateTaskTrackedSeconds(entry.taskId);

  return updated;
}

/** Legt einen abgeschlossenen Eintrag an (manuell oder aus einer Pomodoro-Sitzung). */
export function addFinishedEntry(taskId: string, projectId: string | undefined, startAt: string, endAt: string): TimeEntry {
  const entry = withDuration(
    { id: crypto.randomUUID(), taskId, projectId, startAt, endAt, isRunning: false, updatedAt: '' },
    startAt,
    endAt,
  );
  upsertTimeEntry(entry);
  updateTaskTrackedSeconds(taskId);
  return entry;
}

/** Ändert Zeitraum und/oder Aufgabe eines abgeschlossenen Eintrags. */
export function editFinishedEntry(
  entryId: string,
  patch: { startAt: string; endAt: string; taskId: string; projectId?: string },
): TimeEntry | null {
  const entry = loadTimeEntries().find(e => e.id === entryId);
  if (!entry || !entry.endAt) return null;
  const updated = withDuration({ ...entry, taskId: patch.taskId, projectId: patch.projectId }, patch.startAt, patch.endAt);
  upsertTimeEntry(updated);
  updateTaskTrackedSeconds(patch.taskId);
  if (entry.taskId !== patch.taskId) updateTaskTrackedSeconds(entry.taskId);
  return updated;
}

export function removeEntry(entryId: string): void {
  const entry = loadTimeEntries().find(e => e.id === entryId);
  if (!entry) return;
  deleteTimeEntry(entryId);
  updateTaskTrackedSeconds(entry.taskId);
}

export function getActiveEntry(): TimeEntry | null {
  return loadTimeEntries().find(e => !e.endAt) ?? null;
}

export function sumTrackedSeconds(taskId: string): number {
  return loadTimeEntries()
    .filter(e => e.taskId === taskId && e.endAt)
    .reduce((sum, e) => sum + entrySeconds(e), 0);
}

function updateTaskTrackedSeconds(taskId: string): void {
  const tasks = loadTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  upsertTask({ ...task, trackedSeconds: sumTrackedSeconds(taskId), updatedAt: new Date().toISOString() });
}

const STALE_AFTER_MS = 12 * 60 * 60 * 1000;

/** Ein laufender Eintrag gilt als vergessen: über 12 Stunden offen oder an einem früheren Tag gestartet. */
export function isStaleEntry(entry: TimeEntry, now: number = Date.now()): boolean {
  return now - new Date(entry.startAt).getTime() > STALE_AFTER_MS || toDateKeyFromIso(entry.startAt) !== today();
}
