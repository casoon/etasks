// @module:time-tracking
import type { Project, Task, TimeEntry } from '../domain/types';
import { entrySeconds, toDateKeyFromIso } from '../domain/dateUtils';
import { entryTrackedSeconds } from './dayStats';
import { csvEscape } from './csv';

/** Filter value: every project, only entries without a project, or one project id. */
export type ProjectFilter = 'all' | 'none' | (string & {});

/** Project of an entry: its own project, else the one of its task. */
export function entryProjectId(entry: TimeEntry, tasks: readonly Task[]): string | undefined {
  return entry.projectId ?? tasks.find((t) => t.id === entry.taskId)?.projectId;
}

/** Entries that start within [start, end] (date keys) and match the project filter. */
export function filterEntries(
  entries: readonly TimeEntry[],
  tasks: readonly Task[],
  start: string,
  end: string,
  filter: ProjectFilter,
): TimeEntry[] {
  return entries.filter((e) => {
    const day = toDateKeyFromIso(e.startAt);
    if (!day || day < start || day > end) return false;
    if (filter === 'all') return true;
    const pid = entryProjectId(e, tasks);
    return filter === 'none' ? !pid : pid === filter;
  });
}

export interface DayGroup {
  date: string;
  entries: TimeEntry[];
}

/** Entries grouped by local day, newest day and newest entry first. */
export function groupByDay(entries: readonly TimeEntry[]): DayGroup[] {
  const map = new Map<string, TimeEntry[]>();
  for (const e of entries) {
    const day = toDateKeyFromIso(e.startAt);
    if (!day) continue;
    map.set(day, [...(map.get(day) ?? []), e]);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, list]) => ({
      date,
      entries: list.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()),
    }));
}

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** CSV (semicolon, UTF-8 BOM) of time entries, oldest first; a running entry counts up to `nowMs`. */
export function timeEntriesCsv(
  entries: readonly TimeEntry[],
  tasks: readonly Task[],
  projects: readonly Project[],
  clients: readonly { id: string; name: string }[],
  nowMs: number,
): string {
  const rows: (string | number)[][] = [['Datum', 'Start', 'Ende', 'Minuten', 'Stunden', 'Aufgabe', 'Projekt', 'Kunde']];
  const sorted = [...entries].sort((a, b) => a.startAt.localeCompare(b.startAt));
  for (const e of sorted) {
    const seconds = e.endAt ? entrySeconds(e) : entryTrackedSeconds(e, nowMs);
    const project = projects.find((p) => p.id === entryProjectId(e, tasks));
    rows.push([
      toDateKeyFromIso(e.startAt) ?? '',
      hhmm(e.startAt),
      e.endAt ? hhmm(e.endAt) : '',
      Math.round(seconds / 60),
      (Math.round((seconds / 3600) * 100) / 100).toString().replace('.', ','),
      tasks.find((t) => t.id === e.taskId)?.title ?? '',
      project?.name ?? '',
      clients.find((c) => c.id === project?.clientId)?.name ?? '',
    ]);
  }
  return '﻿' + rows.map((row) => row.map(csvEscape).join(';')).join('\n');
}
