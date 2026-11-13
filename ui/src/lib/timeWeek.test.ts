import { describe, expect, it } from 'vitest';
import type { Project, Task, TimeEntry } from '../domain/types';
import { entryProjectId, filterEntries, groupByDay, timeEntriesCsv } from './timeWeek';

const at = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m).toISOString();
const entry = (id: string, taskId: string, projectId: string | undefined, startAt: string, endAt: string | null, seconds: number | null): TimeEntry => ({
  id, taskId, projectId, startAt, endAt, durationSeconds: seconds, isRunning: endAt == null, updatedAt: '',
});
const task = (id: string, title: string, projectId?: string): Task => ({ id, title, projectId, status: 'todo', tags: [], createdAt: '', updatedAt: '' });
const projects: Project[] = [{ id: 'p1', clientId: 'c1', name: 'Relaunch', color: '#000', status: 'active', createdAt: '' }];
const tasks = [task('t1', 'Layout', 'p1'), task('t2', '=Formel; "x"')];
const entries = [
  entry('a', 't1', 'p1', at(10, 8), at(10, 9), 3600),
  entry('b', 't1', undefined, at(10, 10), at(10, 10, 30), 1800),
  entry('c', 't2', undefined, at(11, 9), at(11, 9, 15), 900),
  entry('d', 't1', 'p1', at(20, 9), at(20, 10), 3600),
];

describe('timeWeek', () => {
  it('takes the project from the task when the entry has none', () => {
    expect(entryProjectId(entries[1], tasks)).toBe('p1');
    expect(entryProjectId(entries[2], tasks)).toBeUndefined();
  });

  it('filters by week and project', () => {
    expect(filterEntries(entries, tasks, '2026-11-09', '2026-11-15', 'all').map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(filterEntries(entries, tasks, '2026-11-09', '2026-11-15', 'p1').map((e) => e.id)).toEqual(['a', 'b']);
    expect(filterEntries(entries, tasks, '2026-11-09', '2026-11-15', 'none').map((e) => e.id)).toEqual(['c']);
  });

  it('groups newest day first and newest entry first', () => {
    const groups = groupByDay(entries.slice(0, 3));
    expect(groups.map((g) => g.date)).toEqual(['2026-11-11', '2026-11-10']);
    expect(groups[1].entries.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('writes a CSV with BOM, escaped cells and the client name', () => {
    const csv = timeEntriesCsv(entries.slice(0, 3), tasks, projects, [{ id: 'c1', name: 'Hansen' }], 0);
    const lines = csv.slice(1).split('\n');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(lines[0]).toBe('Datum;Start;Ende;Minuten;Stunden;Aufgabe;Projekt;Kunde');
    expect(lines[1]).toBe('2026-11-10;08:00;09:00;60;1;Layout;Relaunch;Hansen');
    expect(lines[3]).toBe('2026-11-11;09:00;09:15;15;"0,25";"\'=Formel; ""x""";;');
  });
});
