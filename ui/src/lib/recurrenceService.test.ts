import { describe, it, expect } from 'vitest';
import { isDue, generateDueInstances } from './recurrenceService';
import type { Task, RecurrenceRule } from '../domain/types';

// crypto polyfill for node environments
if (typeof crypto === 'undefined' || !crypto.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID: () => 'uuid-' + Math.random().toString(36).slice(2) },
  });
}

function makeRecurringTemplate(overrides: Partial<Task> = {}): Task {
  return {
    id: 'tmpl-1',
    title: 'Daily standup',
    estimatedMinutes: 15,
    status: 'todo',
    tags: [],
    plannedDate: '2026-03-20',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sortOrder: 1,
    recurrence: { weekdays: [], frequency: 'daily' },
    ...overrides,
  };
}

describe('isDue', () => {
  describe('daily', () => {
    const rule: RecurrenceRule = { weekdays: [], frequency: 'daily' };

    it('is due on the next day', () => {
      expect(isDue(rule, '2026-03-26', '2026-03-27')).toBe(true);
    });

    it('is not due on the same day', () => {
      expect(isDue(rule, '2026-03-27', '2026-03-27')).toBe(false);
    });

    it('is not due on an earlier date', () => {
      expect(isDue(rule, '2026-03-27', '2026-03-26')).toBe(false);
    });

    it('is due multiple days later', () => {
      expect(isDue(rule, '2026-03-01', '2026-03-27')).toBe(true);
    });
  });

  describe('weekly', () => {
    // Friday is day 5
    const rule: RecurrenceRule = { weekdays: [], frequency: 'weekly', dayOfWeek: 5 };

    it('is due on the correct weekday', () => {
      // 2026-03-27 is a Friday
      expect(isDue(rule, '2026-03-20', '2026-03-27')).toBe(true);
    });

    it('is not due on other weekdays', () => {
      // 2026-03-26 is a Thursday
      expect(isDue(rule, '2026-03-20', '2026-03-26')).toBe(false);
      // 2026-03-28 is a Saturday
      expect(isDue(rule, '2026-03-20', '2026-03-28')).toBe(false);
    });

    it('is not due if target is not after lastDate even on correct day', () => {
      expect(isDue(rule, '2026-03-27', '2026-03-27')).toBe(false);
    });

    it('is due the following week on the same weekday', () => {
      expect(isDue(rule, '2026-03-27', '2026-04-03')).toBe(true);
    });
  });

  describe('monthly', () => {
    const rule: RecurrenceRule = { weekdays: [], frequency: 'monthly', dayOfMonth: 15 };

    it('is due on the configured day of month', () => {
      expect(isDue(rule, '2026-02-15', '2026-03-15')).toBe(true);
    });

    it('is not due on other days', () => {
      expect(isDue(rule, '2026-02-15', '2026-03-14')).toBe(false);
      expect(isDue(rule, '2026-02-15', '2026-03-16')).toBe(false);
    });

    it('is due in a future month', () => {
      expect(isDue(rule, '2026-01-15', '2026-06-15')).toBe(true);
    });
  });
});

describe('generateDueInstances', () => {
  it('generates an instance for a due daily task', () => {
    const template = makeRecurringTemplate({ plannedDate: '2026-03-26' });
    const instances = generateDueInstances([template], '2026-03-27');
    expect(instances).toHaveLength(1);
    expect(instances[0].title).toBe(template.title);
    expect(instances[0].plannedDate).toBe('2026-03-27');
    expect(instances[0].sourceTaskId).toBe(template.id);
  });

  it('does not generate a duplicate if instance already exists', () => {
    const template = makeRecurringTemplate({ id: 'tmpl-1', plannedDate: '2026-03-26' });
    const existingInstance: Task = {
      ...makeRecurringTemplate(),
      id: 'inst-1',
      sourceTaskId: 'tmpl-1',
      plannedDate: '2026-03-27',
      recurrence: undefined,
    };
    const instances = generateDueInstances([template, existingInstance], '2026-03-27');
    expect(instances).toHaveLength(0);
  });

  it('does not generate an instance for a task that is not due', () => {
    // Monday template, target is a Friday
    const template = makeRecurringTemplate({
      plannedDate: '2026-03-23',
      recurrence: { weekdays: [], frequency: 'weekly', dayOfWeek: 1 },
    });
    // 2026-03-27 is a Friday
    const instances = generateDueInstances([template], '2026-03-27');
    expect(instances).toHaveLength(0);
  });

  it('skips tasks that are themselves instances (have sourceTaskId)', () => {
    const instance: Task = {
      ...makeRecurringTemplate(),
      id: 'inst-1',
      sourceTaskId: 'tmpl-1',
      plannedDate: '2026-03-26',
    };
    const instances = generateDueInstances([instance], '2026-03-27');
    expect(instances).toHaveLength(0);
  });

  it('generates instances for multiple due templates', () => {
    const t1 = makeRecurringTemplate({ id: 'tmpl-1', plannedDate: '2026-03-26' });
    const t2 = makeRecurringTemplate({ id: 'tmpl-2', title: 'Code review', plannedDate: '2026-03-26' });
    const instances = generateDueInstances([t1, t2], '2026-03-27');
    expect(instances).toHaveLength(2);
  });

  it('copies relevant fields from template to instance', () => {
    const template = makeRecurringTemplate({
      estimatedMinutes: 45,
      tags: ['work'],
      projectId: 'proj-1',
      plannedDate: '2026-03-26',
    });
    const [instance] = generateDueInstances([template], '2026-03-27');
    expect(instance.estimatedMinutes).toBe(45);
    expect(instance.tags).toEqual(['work']);
    expect(instance.projectId).toBe('proj-1');
  });
});
