import type { Task, RecurrenceRule } from '../domain/types';
import { today, toDateKey } from '../domain/dateUtils';
import { createTask } from '../domain/taskService';
import { loadTasks, upsertTask } from './db';

export function isDue(rule: RecurrenceRule, lastDate: string, targetDate: string): boolean {
  const last = new Date(lastDate + 'T00:00:00');
  const target = new Date(targetDate + 'T00:00:00');

  if (target <= last) return false;

  switch (rule.frequency) {
    case 'daily':
      return true;

    case 'weekly': {
      const targetDay = target.getDay(); // 0 = Sonntag
      const dayOfWeek = rule.dayOfWeek ?? last.getDay();
      return targetDay === dayOfWeek;
    }

    case 'monthly': {
      const dayOfMonth = rule.dayOfMonth ?? last.getDate();
      return target.getDate() === dayOfMonth;
    }
  }
}

export function generateDueInstances(allTasks: Task[], targetDate: string): Task[] {
  const recurringTemplates = allTasks.filter(t => t.recurrence && !t.sourceTaskId);
  const existingInstances = allTasks.filter(t => t.sourceTaskId && t.plannedDate === targetDate);
  const existingSourceIds = new Set(existingInstances.map(t => t.sourceTaskId!));

  const newTasks: Task[] = [];

  for (const template of recurringTemplates) {
    if (existingSourceIds.has(template.id)) continue;
    if (!isDue(template.recurrence!, template.plannedDate ?? '', targetDate)) continue;

    const instance = createTask({
      title: template.title,
      estimatedMinutes: template.estimatedMinutes,
      tags: template.tags,
      plannedDate: targetDate,
      projectId: template.projectId,
      sourceTaskId: template.id,
    });
    newTasks.push(instance);
  }

  return newTasks;
}

export function initRecurringTasks(): void {
  const allTasks = loadTasks();
  const todayStr = today();
  const newInstances = generateDueInstances(allTasks, todayStr);

  for (const task of newInstances) {
    upsertTask(task);
  }
}
