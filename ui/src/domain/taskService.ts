// @core
import { type Task, type TaskStatus, type KanbanStatus } from './types';
import { toDateKey } from './dateUtils';

export function createTask(partial: Partial<Task> & { title: string }): Task {
  return {
    id: crypto.randomUUID(),
    title: partial.title,
    estimatedMinutes: partial.estimatedMinutes ?? null,
    status: 'todo',
    tags: partial.tags ?? [],
    scheduledStart: partial.scheduledStart ?? null,
    scheduledEnd: partial.scheduledEnd ?? null,
    plannedDate: partial.plannedDate ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sortOrder: partial.sortOrder ?? Date.now(),
    priorityRank: partial.priorityRank ?? null,
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

const SLOT_STEP_MS = 15 * 60 * 1000;

// Places open tasks into free slots of `date` (default: today) between dayStart and dayEnd (hours).
// When planning the current day, nothing starts before `now` (rounded up to 15 min).
// A slot must end by dayEnd; tasks that do not fit are returned without scheduledStart.
export function autoScheduleTasks(
  tasks: Task[],
  blocks: { start: Date; end: Date }[],
  dayStart = 9,
  dayEnd = 18,
  options: { date?: string; now?: Date } = {},
): Task[] {
  const unscheduled = tasks.filter((t) => t.status === 'todo' && !t.scheduledStart);
  const busySlots = blocks.map((b) => ({ start: b.start.getTime(), end: b.end.getTime() }));

  const now = options.now ?? new Date();
  const day = options.date ? new Date(`${options.date}T00:00:00`) : new Date(now);
  const startOfDay = new Date(day);
  startOfDay.setHours(dayStart, 0, 0, 0);
  const endOfDay = new Date(day);
  endOfDay.setHours(dayEnd, 0, 0, 0);

  let cursor = startOfDay.getTime();
  if (toDateKey(day) === toDateKey(now)) {
    cursor = Math.max(cursor, Math.ceil(now.getTime() / SLOT_STEP_MS) * SLOT_STEP_MS);
  }

  const result: Task[] = [];

  for (const task of unscheduled) {
    const durationMs = (task.estimatedMinutes ?? 30) * 60 * 1000;
    let probe = cursor;
    let placed = false;

    while (probe + durationMs <= endOfDay.getTime()) {
      const slotEnd = probe + durationMs;
      const overlaps = busySlots.some((s) => probe < s.end && slotEnd > s.start);

      if (!overlaps) {
        result.push({ ...task, scheduledStart: new Date(probe).toISOString() });
        busySlots.push({ start: probe, end: slotEnd });
        cursor = slotEnd;
        placed = true;
        break;
      }
      probe += SLOT_STEP_MS;
    }

    if (!placed) result.push(task);
  }

  return result;
}
