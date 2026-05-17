// @core
import { atom, computed } from 'nanostores';
import type { Task, KanbanStatus } from '../domain/types';
import { today } from '../domain/dateUtils';
import { createTask } from '../domain/taskService';
import { loadTasks, upsertTask, deleteTask as dbDeleteTask } from '../lib/db';

export const $tasks = atom<Task[]>([]);
export const $activeDate = atom<string>(today());

export const $todayTasks = computed([$tasks, $activeDate], (tasks, date) =>
  tasks.filter((t) => t.plannedDate === date).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
);

export const $doneTasks = computed($todayTasks, (tasks) => tasks.filter((t) => t.status === 'done'));

export const $completionRate = computed([$todayTasks, $doneTasks], (all, done) =>
  all.length === 0 ? 0 : Math.round((done.length / all.length) * 100)
);

export function initTasks(): void {
  $tasks.set(loadTasks());
}

export function addTask(
  title: string,
  estimatedMinutes = 30,
  tags: string[] = [],
  projectId?: string,
  kanbanStatus?: KanbanStatus,
): Task {
  const task = createTask({
    title,
    estimatedMinutes,
    tags,
    plannedDate: $activeDate.get(),
    projectId,
    kanbanStatus: kanbanStatus ?? (projectId ? 'backlog' : undefined),
  });
  $tasks.set(upsertTask(task));
  return task;
}

export function toggleTask(id: string): void {
  const task = $tasks.get().find((t) => t.id === id);
  if (!task) return;
  const isDone = task.status !== 'done';
  const now = new Date().toISOString();
  $tasks.set(upsertTask({
    ...task,
    status: isDone ? 'done' : 'todo',
    kanbanStatus: isDone ? 'done' : (task.kanbanStatus === 'done' ? 'backlog' : task.kanbanStatus),
    completedAt: isDone ? now : null,
    updatedAt: now,
  }));
}

export function updateTask(id: string, patch: Partial<Task>): void {
  const task = $tasks.get().find((t) => t.id === id);
  if (!task) return;
  const now = new Date().toISOString();
  // Auto-derive plannedDate from scheduledStart if not explicitly set
  const resolved: Partial<Task> =
    patch.scheduledStart && !patch.plannedDate
      ? { ...patch, plannedDate: patch.scheduledStart.slice(0, 10) }
      : patch;
  $tasks.set(upsertTask({ ...task, ...resolved, updatedAt: now }));
}

export function removeTask(id: string): void {
  $tasks.set(dbDeleteTask(id));
}

export function cloneRecurringTask(templateId: string, plannedDate: string): Task {
  const template = $tasks.get().find((t) => t.id === templateId);
  if (!template) throw new Error('Recurring template not found');
  const now = new Date().toISOString();
  const clone: Task = {
    ...template,
    id: crypto.randomUUID(),
    sourceTaskId: templateId,
    plannedDate,
    status: 'todo',
    recurrence: undefined,
    kanbanStatus: undefined,
    sortOrder: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
  $tasks.set(upsertTask(clone));
  return clone;
}

export function reorderTasks(orderedIds: string[]): void {
  const tasks = $tasks.get();
  const updated = orderedIds
    .map((id, i) => {
      const t = tasks.find((x) => x.id === id);
      return t ? { ...t, sortOrder: i } : null;
    })
    .filter(Boolean) as Task[];

  updated.forEach((t) => upsertTask(t));
  const unchanged = tasks.filter((t) => !orderedIds.includes(t.id));
  $tasks.set([...updated, ...unchanged]);
}