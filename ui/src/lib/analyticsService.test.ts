import { describe, expect, it } from 'vitest';
import type { Task, TimeEntry } from '../domain/types';
import { tasksPlannedInWeek, trackedMinutesByTag } from './analyticsService';
import { getWeekRange } from '../domain/dateUtils';

const task = (o: Partial<Task>): Task =>
  ({ id: 't', title: 'T', status: 'todo', tags: [], createdAt: '', updatedAt: '', ...o }) as Task;
const entry = (o: Partial<TimeEntry>): TimeEntry =>
  ({ id: 'e', taskId: 't', startAt: '2026-03-11T10:00:00', endAt: '', durationSeconds: 3600, isRunning: false, updatedAt: '', ...o }) as TimeEntry;

describe('getWeekRange', () => {
  it('runs Monday to Sunday', () => {
    expect(getWeekRange(new Date('2026-03-11T12:00:00'))).toEqual({ start: '2026-03-09', end: '2026-03-15' });
    expect(getWeekRange(new Date('2026-03-15T12:00:00'))).toEqual({ start: '2026-03-09', end: '2026-03-15' });
  });
});

describe('tasksPlannedInWeek', () => {
  it('counts only tasks inside the week and no templates', () => {
    const tasks = [
      task({ id: 'a', plannedDate: '2026-03-09' }),
      task({ id: 'b', plannedDate: '2026-03-15' }),
      task({ id: 'c', plannedDate: '2026-03-16' }),
      task({ id: 'd', plannedDate: '2026-03-08' }),
      task({ id: 'e', plannedDate: '2026-03-10', recurrence: { weekdays: [2] } }),
      task({ id: 'f', plannedDate: null }),
    ];
    expect(tasksPlannedInWeek(tasks, '2026-03-09', '2026-03-15').map((t) => t.id)).toEqual(['a', 'b']);
  });
});

describe('trackedMinutesByTag', () => {
  it('sums tracked time per first tag inside the week', () => {
    const tasks = [task({ id: 'a', tags: ['work', 'x'] }), task({ id: 'b' })];
    const result = trackedMinutesByTag(
      [
        entry({ taskId: 'a' }),
        entry({ id: 'e2', taskId: 'a', durationSeconds: 1800 }),
        entry({ id: 'e3', taskId: 'b' }),
        entry({ id: 'e4', taskId: 'gone', durationSeconds: 600 }),
        entry({ id: 'e5', taskId: 'a', startAt: '2026-03-16T10:00:00' }),
      ],
      tasks,
      '2026-03-09',
      '2026-03-15',
    );
    expect(result).toEqual({ work: 90, sonstige: 70 });
  });
});
