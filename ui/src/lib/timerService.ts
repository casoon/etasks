import type { TimeEntry } from '../domain/types';
import { loadTimeEntries, upsertTimeEntry, loadTasks, upsertTask } from './db';
export { formatTrackedTime, formatElapsed } from '../domain/dateUtils';

export function startTimer(taskId: string, projectId?: string): TimeEntry {
  // Laufenden Timer stoppen falls vorhanden
  const running = getActiveEntry();
  if (running) stopTimer(running.id);

  const entry: TimeEntry = {
    id: crypto.randomUUID(),
    taskId,
    projectId,
    startedAt: new Date().toISOString(),
    stoppedAt: undefined,
    durationSeconds: 0,
  };
  upsertTimeEntry(entry);
  return entry;
}

export function stopTimer(entryId: string): TimeEntry | null {
  const entries = loadTimeEntries();
  const entry = entries.find(e => e.id === entryId);
  if (!entry || entry.stoppedAt) return null;

  const stopped = new Date().toISOString();
  const durationSeconds = Math.round(
    (new Date(stopped).getTime() - new Date(entry.startedAt).getTime()) / 1000
  );
  const updated: TimeEntry = { ...entry, stoppedAt: stopped, durationSeconds };
  upsertTimeEntry(updated);

  // trackedSeconds auf Task aktualisieren
  updateTaskTrackedSeconds(entry.taskId);

  return updated;
}

export function getActiveEntry(): TimeEntry | null {
  return loadTimeEntries().find(e => !e.stoppedAt) ?? null;
}

export function sumTrackedSeconds(taskId: string): number {
  return loadTimeEntries()
    .filter(e => e.taskId === taskId && e.stoppedAt)
    .reduce((sum, e) => sum + e.durationSeconds, 0);
}

function updateTaskTrackedSeconds(taskId: string): void {
  const tasks = loadTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  upsertTask({ ...task, trackedSeconds: sumTrackedSeconds(taskId) });
}

