// @module:planning
import type { Project, Task, TimeEntry } from '../domain/types';
import { addDaysToKey, toDateKeyFromIso, diffDays } from '../domain/dateUtils';
import { entryTrackedSeconds } from './dayStats';

export const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

/** Seven date keys Monday to Sunday for the week starting at `weekStart`. */
export function weekDayKeys(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i));
}

/** Longest run of consecutive marked days inside the week. */
export function longestStreak(completedDays: readonly string[], weekDays: readonly string[]): number {
  const marked = new Set(completedDays);
  let best = 0;
  let run = 0;
  for (const day of weekDays) {
    run = marked.has(day) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export interface DayBar {
  date: string;
  plannedMinutes: number;
  trackedMinutes: number;
}

/** Planned (task estimates) and tracked minutes per day; the running entry counts with its elapsed time. */
export function dayBars(
  weekDays: readonly string[],
  tasks: readonly Task[],
  entries: readonly TimeEntry[],
  nowMs: number,
): DayBar[] {
  return weekDays.map((date) => ({
    date,
    plannedMinutes: tasks
      .filter((t) => !t.recurrence && t.plannedDate === date)
      .reduce((sum, t) => sum + (t.estimatedMinutes ?? 0), 0),
    trackedMinutes: entries
      .filter((e) => toDateKeyFromIso(e.startAt) === date)
      .reduce((sum, e) => sum + entryTrackedSeconds(e, nowMs) / 60, 0),
  }));
}

export interface ProjectMinutes {
  id: string;
  name: string;
  color: string;
  minutes: number;
}

export const NO_PROJECT_ID = 'ohne-projekt';

/** Tracked minutes per project within [start, end]; entries without a project are listed as „Ohne Projekt“. */
export function trackedMinutesByProject(
  entries: readonly TimeEntry[],
  projects: readonly Project[],
  start: string,
  end: string,
  nowMs: number,
): ProjectMinutes[] {
  const byId = new Map(projects.map((p) => [p.id, p]));
  const sums = new Map<string, number>();
  for (const e of entries) {
    const day = toDateKeyFromIso(e.startAt);
    if (!day || day < start || day > end) continue;
    const seconds = entryTrackedSeconds(e, nowMs);
    if (seconds <= 0) continue;
    const id = e.projectId && byId.has(e.projectId) ? e.projectId : NO_PROJECT_ID;
    sums.set(id, (sums.get(id) ?? 0) + seconds / 60);
  }
  return [...sums.entries()]
    .map(([id, minutes]) => ({
      id,
      name: byId.get(id)?.name ?? 'Ohne Projekt',
      color: byId.get(id)?.color ?? '#8A877F',
      minutes: Math.round(minutes),
    }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** Minutes within [start, end] split into customer projects (project has a client) and internal/no project. */
export function customerMinutes(
  entries: readonly TimeEntry[],
  projects: readonly Project[],
  start: string,
  end: string,
  nowMs: number,
): { customer: number; internal: number } {
  const clientOf = new Map(projects.map((p) => [p.id, !!p.clientId]));
  let customer = 0;
  let internal = 0;
  for (const e of entries) {
    const day = toDateKeyFromIso(e.startAt);
    if (!day || day < start || day > end) continue;
    const minutes = entryTrackedSeconds(e, nowMs) / 60;
    if (e.projectId && clientOf.get(e.projectId)) customer += minutes;
    else internal += minutes;
  }
  return { customer: Math.round(customer), internal: Math.round(internal) };
}

export interface LeadTimeStats {
  count: number;
  avgDays: number | null;
  byProject: { name: string; color: string; avgDays: number; count: number }[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Average days from creation to completion over all completed tasks, plus the five fastest projects. */
export function leadTimeStats(tasks: readonly Task[], projects: readonly Project[]): LeadTimeStats {
  const completed = tasks.filter((t) => t.status === 'done' && !!t.completedAt);
  const all: number[] = [];
  const grouped = new Map<string, { name: string; color: string; values: number[] }>();
  for (const task of completed) {
    const days = diffDays(task.createdAt, task.completedAt ?? null);
    if (days == null || days < 0) continue;
    all.push(days);
    const pid = task.projectId ?? NO_PROJECT_ID;
    const project = projects.find((p) => p.id === pid);
    const entry = grouped.get(pid) ?? { name: project?.name ?? 'Ohne Projekt', color: project?.color ?? '#8A877F', values: [] };
    entry.values.push(days);
    grouped.set(pid, entry);
  }
  return {
    count: completed.length,
    avgDays: all.length > 0 ? round1(all.reduce((s, d) => s + d, 0) / all.length) : null,
    byProject: [...grouped.values()]
      .map((g) => ({ name: g.name, color: g.color, avgDays: round1(g.values.reduce((s, d) => s + d, 0) / g.values.length), count: g.values.length }))
      .sort((a, b) => a.avgDays - b.avgDays)
      .slice(0, 5),
  };
}

/** `9. bis 15. November`, or `30. November bis 6. Dezember` when the week spans two months. */
export function formatWeekRange(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(`${addDaysToKey(weekStart, 6)}T00:00:00`);
  const month = (d: Date) => d.toLocaleDateString('de-DE', { month: 'long' });
  const startPart = start.getMonth() === end.getMonth() ? `${start.getDate()}.` : `${start.getDate()}. ${month(start)}`;
  return `${startPart} bis ${end.getDate()}. ${month(end)}`;
}
