// @module:planning
import type { Task, TimeEntry } from '../domain/types';
import { entrySeconds, toDateKeyFromIso } from '../domain/dateUtils';

export const NO_TAG = 'sonstige';

/** Tasks planned inside the week [start, end] (inclusive keys); recurring templates are not tasks. */
export function tasksPlannedInWeek(tasks: readonly Task[], start: string, end: string): Task[] {
  return tasks.filter((t) => !t.recurrence && !!t.plannedDate && t.plannedDate >= start && t.plannedDate <= end);
}

/** Tracked minutes per first tag of the entry's task within [start, end]; untagged or deleted tasks count as "sonstige". */
export function trackedMinutesByTag(
  entries: readonly TimeEntry[],
  tasks: readonly Task[],
  start: string,
  end: string,
): Record<string, number> {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const result: Record<string, number> = {};
  for (const e of entries) {
    const day = toDateKeyFromIso(e.startAt);
    const seconds = entrySeconds(e);
    if (!day || day < start || day > end || seconds <= 0) continue;
    const tag = taskMap.get(e.taskId)?.tags[0] ?? NO_TAG;
    result[tag] = (result[tag] ?? 0) + seconds / 60;
  }
  return result;
}
