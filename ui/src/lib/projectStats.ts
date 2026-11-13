// @module:projects
import type { Client, Project, Task, TimeEntry } from '../domain/types';
import { addDaysToKey, diffDays } from '../domain/dateUtils';
import { entryTrackedSeconds } from './dayStats';
import { entryProjectId } from './timeWeek';

export interface ProjectStats {
  total: number;
  done: number;
  open: number;
  inProgress: number;
  trackedMinutes: number;
}

/** Task counts (without recurring templates) and tracked minutes of one project. */
export function projectStats(
  projectId: string,
  tasks: readonly Task[],
  entries: readonly TimeEntry[],
  nowMs: number,
): ProjectStats {
  const own = tasks.filter((t) => t.projectId === projectId && !t.recurrence);
  const seconds = entries
    .filter((e) => entryProjectId(e, tasks) === projectId)
    .reduce((sum, e) => sum + entryTrackedSeconds(e, nowMs), 0);
  return {
    total: own.length,
    done: own.filter((t) => t.status === 'done').length,
    open: own.filter((t) => t.status === 'todo').length,
    inProgress: own.filter((t) => t.status === 'todo' && t.kanbanStatus === 'in_progress').length,
    trackedMinutes: Math.round(seconds / 60),
  };
}

export type DeadlineState = 'overdue' | 'soon' | 'later' | 'none';

/** Overdue before today, soon within the next 7 days; finished projects have no mark. */
export function deadlineState(project: Pick<Project, 'deadline' | 'status'>, todayKey: string): DeadlineState {
  if (!project.deadline) return 'none';
  if (project.status === 'done') return 'later';
  if (project.deadline < todayKey) return 'overdue';
  return project.deadline <= addDaysToKey(todayKey, 7) ? 'soon' : 'later';
}

/** `18.11.`, plus `in 6 Tagen`, `heute`, `morgen` or `überfällig` while the mark applies. */
export function deadlineLabel(project: Pick<Project, 'deadline' | 'status'>, todayKey: string): string {
  if (!project.deadline) return 'keine';
  const [, month, day] = project.deadline.split('-');
  const date = `${day}.${month}.`;
  const state = deadlineState(project, todayKey);
  if (state === 'overdue') return `${date} · überfällig`;
  if (state !== 'soon') return date;
  const days = diffDays(todayKey, project.deadline) ?? 0;
  return `${date} · ${days === 0 ? 'heute' : days === 1 ? 'morgen' : `in ${days} Tagen`}`;
}

export type StatusFilter = Project['status'] | 'all';

/** Status filter plus a search over project and client name; sorted by name. */
export function filterProjects(
  projects: readonly Project[],
  clients: readonly Pick<Client, 'id' | 'name'>[],
  status: StatusFilter,
  query: string,
): Project[] {
  const q = query.trim().toLocaleLowerCase('de-DE');
  const clientName = (p: Project) => clients.find((c) => c.id === p.clientId)?.name ?? '';
  return projects
    .filter((p) => status === 'all' || p.status === status)
    .filter((p) => !q || p.name.toLocaleLowerCase('de-DE').includes(q) || clientName(p).toLocaleLowerCase('de-DE').includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
