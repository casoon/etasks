import { type Task, type TaskStatus, type KanbanStatus } from './types';

export function createTask(partial: Partial<Task> & { title: string; date: string }): Task {
  return {
    id: crypto.randomUUID(),
    title: partial.title,
    duration: partial.duration ?? 30,
    status: 'todo',
    tags: partial.tags ?? [],
    scheduledAt: partial.scheduledAt,
    date: partial.date,
    createdAt: new Date().toISOString(),
    order: partial.order ?? Date.now(),
    projectId: partial.projectId,
    kanbanStatus: partial.kanbanStatus,
    notes: partial.notes,
    recurrence: partial.recurrence,
    sourceTaskId: partial.sourceTaskId,
  };
}

export function getCompletionRate(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.status === 'done').length;
  return Math.round((done / tasks.length) * 100);
}

export function autoScheduleTasks(
  tasks: Task[],
  blocks: { start: Date; end: Date }[],
  dayStart = 9,
  dayEnd = 18,
): Task[] {
  const unscheduled = tasks.filter((t) => t.status === 'todo' && !t.scheduledAt);
  const busySlots = blocks.map((b) => ({ start: b.start.getTime(), end: b.end.getTime() }));

  let cursor = new Date();
  cursor.setHours(dayStart, 0, 0, 0);

  const result: Task[] = [];

  for (const task of unscheduled) {
    const durationMs = task.duration * 60 * 1000;
    let placed = false;

    while (cursor.getHours() < dayEnd) {
      const slotEnd = cursor.getTime() + durationMs;
      const overlaps = busySlots.some((s) => cursor.getTime() < s.end && slotEnd > s.start);

      if (!overlaps) {
        result.push({ ...task, scheduledAt: cursor.toISOString() });
        busySlots.push({ start: cursor.getTime(), end: slotEnd });
        cursor = new Date(slotEnd);
        placed = true;
        break;
      }
      cursor = new Date(cursor.getTime() + 15 * 60 * 1000);
    }

    if (!placed) result.push(task);
  }

  return result;
}
