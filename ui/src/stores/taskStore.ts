import { atom, computed } from 'nanostores';
import type { Task, KanbanStatus } from '../domain/types';
import { today } from '../domain/dateUtils';
import { createTask } from '../domain/taskService';
import { loadTasks, upsertTask, deleteTask as dbDeleteTask } from '../lib/db';

export const $tasks = atom<Task[]>([]);
export const $activeDate = atom<string>(today());

export const $todayTasks = computed([$tasks, $activeDate], (tasks, date) =>
  tasks.filter((t) => t.date === date).sort((a, b) => a.order - b.order)
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
  duration = 30,
  tags: string[] = [],
  projectId?: string,
  kanbanStatus?: KanbanStatus,
): void {
  const task = createTask({
    title,
    duration,
    tags,
    date: $activeDate.get(),
    projectId,
    kanbanStatus: kanbanStatus ?? (projectId ? 'backlog' : undefined),
  });
  $tasks.set(upsertTask(task));
}

export function toggleTask(id: string): void {
  const task = $tasks.get().find((t) => t.id === id);
  if (!task) return;
  const isDone = task.status !== 'done';
  $tasks.set(upsertTask({
    ...task,
    status: isDone ? 'done' : 'todo',
    kanbanStatus: isDone ? 'done' : (task.kanbanStatus === 'done' ? 'backlog' : task.kanbanStatus),
  }));
}

export function updateTask(id: string, patch: Partial<Task>): void {
  const task = $tasks.get().find((t) => t.id === id);
  if (!task) return;
  $tasks.set(upsertTask({ ...task, ...patch }));
}

export function removeTask(id: string): void {
  $tasks.set(dbDeleteTask(id));
}

export function reorderTasks(orderedIds: string[]): void {
  const tasks = $tasks.get();
  const updated = orderedIds
    .map((id, i) => {
      const t = tasks.find((x) => x.id === id);
      return t ? { ...t, order: i } : null;
    })
    .filter(Boolean) as Task[];

  updated.forEach((t) => upsertTask(t));
  const unchanged = tasks.filter((t) => !orderedIds.includes(t.id));
  $tasks.set([...updated, ...unchanged]);
}
