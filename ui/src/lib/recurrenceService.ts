// @core
import type { Task, RecurrenceRule } from '../domain/types';
import { today, isRecurringDueOn } from '../domain/dateUtils';
import { createTask } from '../domain/taskService';
import { loadTasks, upsertTask } from './db';

export function isDue(rule: RecurrenceRule, lastDate: string, targetDate: string): boolean {
  if (lastDate && targetDate <= lastDate) return false;
  return isRecurringDueOn(rule, targetDate);
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