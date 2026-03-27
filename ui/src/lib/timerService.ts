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
    startAt: new Date().toISOString(),
    endAt: null,
    durationMinutes: null,
    isRunning: true,
    updatedAt: new Date().toISOString(),
  };
  upsertTimeEntry(entry);
  return entry;
}

export function stopTimer(entryId: string): TimeEntry | null {
  const entries = loadTimeEntries();
  const entry = entries.find(e => e.id === entryId);
  if (!entry || entry.endAt) return null;

  const stopped = new Date().toISOString();
  const durationMinutes = Math.round(
    (new Date(stopped).getTime() - new Date(entry.startAt).getTime()) / 60000
  );
  const updated: TimeEntry = {
    ...entry,
    endAt: stopped,
    durationMinutes,
    isRunning: false,
    updatedAt: new Date().toISOString(),
  };
  upsertTimeEntry(updated);

  // trackedSeconds auf Task aktualisieren
  updateTaskTrackedSeconds(entry.taskId);

  return updated;
}

export function getActiveEntry(): TimeEntry | null {
  return loadTimeEntries().find(e => !e.endAt) ?? null;
}

export function sumTrackedMinutes(taskId: string): number {
  return loadTimeEntries()
    .filter(e => e.taskId === taskId && e.endAt)
    .reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
}

function updateTaskTrackedSeconds(taskId: string): void {
  const tasks = loadTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  const minutes = sumTrackedMinutes(taskId);
  upsertTask({ ...task, trackedSeconds: minutes * 60, updatedAt: new Date().toISOString() });
}
