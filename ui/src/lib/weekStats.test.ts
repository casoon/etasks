import { describe, expect, it } from 'vitest';
import type { Project, Task, TimeEntry } from '../domain/types';
import { customerMinutes, dayBars, formatWeekRange, leadTimeStats, longestStreak, trackedMinutesByProject, weekDayKeys } from './weekStats';

const at = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m).toISOString();
const now = new Date(2026, 10, 12, 12, 0).getTime();

const project = (id: string, clientId: string): Project => ({ id, clientId, name: `P ${id}`, color: '#2456D6', status: 'active', createdAt: '' });
const entry = (id: string, projectId: string | undefined, startAt: string, seconds: number | null): TimeEntry => ({
  id, taskId: 't', projectId, startAt, endAt: seconds == null ? null : startAt, durationSeconds: seconds, isRunning: seconds == null, updatedAt: '',
});
const task = (patch: Partial<Task>): Task => ({ id: 'x', title: 'x', status: 'todo', tags: [], createdAt: '', updatedAt: '', ...patch });

describe('weekStats', () => {
  it('lists Monday to Sunday', () => {
    expect(weekDayKeys('2026-11-09')).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
  });

  it('finds the longest streak of marked days', () => {
    const week = weekDayKeys('2026-11-09');
    expect(longestStreak([week[0], week[1], week[2], week[3]], week)).toBe(4);
    expect(longestStreak([week[0], week[2], week[3]], week)).toBe(2);
    expect(longestStreak([], week)).toBe(0);
  });

  it('builds planned and tracked minutes per day including the running entry', () => {
    const week = weekDayKeys('2026-11-09');
    const bars = dayBars(
      week,
      [task({ plannedDate: '2026-11-12', estimatedMinutes: 90 }), task({ plannedDate: '2026-11-12', estimatedMinutes: 30 }), task({ plannedDate: '2026-11-12', estimatedMinutes: 500, recurrence: { weekdays: [4] } })],
      [entry('a', 'p', at(12, 8), 3600), entry('b', 'p', at(12, 11, 30), null), entry('c', 'p', at(10, 8), 1800)],
      now,
    );
    expect(bars[3]).toEqual({ date: '2026-11-12', plannedMinutes: 120, trackedMinutes: 90 });
    expect(bars[1].trackedMinutes).toBe(30);
    expect(bars[0]).toEqual({ date: '2026-11-09', plannedMinutes: 0, trackedMinutes: 0 });
  });

  it('sums by project inside the range and names missing projects', () => {
    const rows = trackedMinutesByProject(
      [entry('a', 'p1', at(10, 8), 3600), entry('b', undefined, at(11, 8), 600), entry('c', 'p1', at(20, 8), 3600)],
      [project('p1', 'c1')],
      '2026-11-09',
      '2026-11-15',
      now,
    );
    expect(rows).toEqual([
      { id: 'p1', name: 'P p1', color: '#2456D6', minutes: 60 },
      { id: 'ohne-projekt', name: 'Ohne Projekt', color: '#8A877F', minutes: 10 },
    ]);
  });

  it('splits customer and internal minutes', () => {
    const split = customerMinutes(
      [entry('a', 'p1', at(10, 8), 3600), entry('b', 'p2', at(10, 9), 1800), entry('c', undefined, at(10, 10), 600)],
      [project('p1', 'c1'), project('p2', '')],
      '2026-11-09',
      '2026-11-15',
      now,
    );
    expect(split).toEqual({ customer: 60, internal: 40 });
  });

  it('averages lead time', () => {
    const stats = leadTimeStats(
      [
        task({ status: 'done', createdAt: '2026-11-01T08:00:00', completedAt: '2026-11-03T08:00:00', projectId: 'p1' }),
        task({ status: 'done', createdAt: '2026-11-01T08:00:00', completedAt: '2026-11-02T08:00:00', projectId: 'p1' }),
        task({ status: 'todo' }),
      ],
      [project('p1', 'c1')],
    );
    expect(stats.count).toBe(2);
    expect(stats.avgDays).toBe(1.5);
    expect(stats.byProject).toEqual([{ name: 'P p1', color: '#2456D6', avgDays: 1.5, count: 2 }]);
  });

  it('formats the week range', () => {
    expect(formatWeekRange('2026-11-09')).toBe('9. bis 15. November');
    expect(formatWeekRange('2026-11-30')).toBe('30. November bis 6. Dezember');
  });
});
