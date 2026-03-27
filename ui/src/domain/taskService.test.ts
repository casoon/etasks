import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTask, getCompletionRate, autoScheduleTasks } from './taskService';
import type { Task } from './types';

// crypto.randomUUID is available in node 19+; polyfill for older environments
if (typeof crypto === 'undefined' || !crypto.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2) },
  });
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-' + Math.random(),
    title: 'Task',
    estimatedMinutes: 30,
    status: 'todo',
    tags: [],
    plannedDate: '2026-03-27',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sortOrder: Date.now(),
    ...overrides,
  };
}

describe('createTask', () => {
  it('creates a task with required fields', () => {
    const t = createTask({ title: 'Hello', plannedDate: '2026-03-27' });
    expect(t.title).toBe('Hello');
    expect(t.plannedDate).toBe('2026-03-27');
    expect(t.status).toBe('todo');
  });

  it('defaults estimatedMinutes to null', () => {
    const t = createTask({ title: 'T' });
    expect(t.estimatedMinutes).toBeNull();
  });

  it('respects provided estimatedMinutes', () => {
    const t = createTask({ title: 'T', estimatedMinutes: 90 });
    expect(t.estimatedMinutes).toBe(90);
  });

  it('defaults tags to empty array', () => {
    const t = createTask({ title: 'T' });
    expect(t.tags).toEqual([]);
  });
});

describe('getCompletionRate', () => {
  it('returns 0 for empty task list', () => {
    expect(getCompletionRate([])).toBe(0);
  });

  it('returns 0 when no tasks are done', () => {
    expect(getCompletionRate([makeTask(), makeTask()])).toBe(0);
  });

  it('returns 100 when all tasks are done', () => {
    const tasks = [makeTask({ status: 'done' }), makeTask({ status: 'done' })];
    expect(getCompletionRate(tasks)).toBe(100);
  });

  it('returns correct percentage for mixed tasks', () => {
    const tasks = [
      makeTask({ status: 'done' }),
      makeTask({ status: 'done' }),
      makeTask(),
      makeTask(),
    ];
    expect(getCompletionRate(tasks)).toBe(50);
  });

  it('rounds to nearest integer', () => {
    const tasks = [makeTask({ status: 'done' }), makeTask(), makeTask()];
    expect(getCompletionRate(tasks)).toBe(33);
  });
});

describe('autoScheduleTasks', () => {
  beforeEach(() => {
    // Fix system time to 2026-03-27 08:00 local time so dayStart=9 is in the future
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-27T08:00:00'));
  });

  it('schedules unscheduled tasks starting from dayStart', () => {
    const tasks = [makeTask({ estimatedMinutes: 60 })];
    const result = autoScheduleTasks(tasks, [], 9, 18);
    expect(result[0].scheduledStart).toBeDefined();
    const scheduled = new Date(result[0].scheduledStart!);
    expect(scheduled.getHours()).toBe(9);
    expect(scheduled.getMinutes()).toBe(0);
  });

  it('places consecutive tasks back to back', () => {
    const tasks = [makeTask({ estimatedMinutes: 60 }), makeTask({ estimatedMinutes: 30 })];
    const result = autoScheduleTasks(tasks, [], 9, 18);
    const first = new Date(result[0].scheduledStart!);
    const second = new Date(result[1].scheduledStart!);
    expect(second.getTime() - first.getTime()).toBe(60 * 60 * 1000);
  });

  it('skips already-scheduled tasks', () => {
    const alreadyScheduled = makeTask({ scheduledStart: '2026-03-27T10:00:00.000Z' });
    const result = autoScheduleTasks([alreadyScheduled], [], 9, 18);
    expect(result).toHaveLength(0);
  });

  it('skips done tasks', () => {
    const done = makeTask({ status: 'done' });
    const result = autoScheduleTasks([done], [], 9, 18);
    expect(result).toHaveLength(0);
  });

  it('avoids busy calendar blocks', () => {
    const tasks = [makeTask({ estimatedMinutes: 60 })];
    const busyStart = new Date('2026-03-27');
    busyStart.setHours(9, 0, 0, 0);
    const busyEnd = new Date('2026-03-27');
    busyEnd.setHours(10, 0, 0, 0);

    const result = autoScheduleTasks(tasks, [{ start: busyStart, end: busyEnd }], 9, 18);
    const scheduled = new Date(result[0].scheduledStart!);
    expect(scheduled.getHours()).toBeGreaterThanOrEqual(10);
  });

  it('leaves task unscheduled if no slot fits before dayEnd', () => {
    const tasks = [makeTask({ estimatedMinutes: 60 })];
    // Tiny window: 9:00–9:30 only, task needs 60 min
    const busyStart = new Date('2026-03-27');
    busyStart.setHours(9, 30, 0, 0);
    const busyEnd = new Date('2026-03-27');
    busyEnd.setHours(18, 0, 0, 0);

    const result = autoScheduleTasks(tasks, [{ start: busyStart, end: busyEnd }], 9, 18);
    // 30-min window can't fit 60-min task → returned without scheduledStart
    expect(result[0].scheduledStart).toBeUndefined();
  });
});
