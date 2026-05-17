// @module:calendar
import type { CalendarBlock, Task } from './types';

export function createBlockFromTask(task: Task, start: Date): CalendarBlock {
  const end = new Date(start.getTime() + (task.estimatedMinutes ?? 30) * 60 * 1000);
  return {
    id: crypto.randomUUID(),
    taskId: task.id,
    title: task.title,
    start: start.toISOString(),
    end: end.toISOString(),
    date: task.plannedDate ?? '',
  };
}

export function resizeBlock(block: CalendarBlock, newEnd: Date): CalendarBlock {
  return { ...block, end: newEnd.toISOString() };
}

export function moveBlock(block: CalendarBlock, newStart: Date): CalendarBlock {
  const duration = new Date(block.end).getTime() - new Date(block.start).getTime();
  return {
    ...block,
    start: newStart.toISOString(),
    end: new Date(newStart.getTime() + duration).toISOString(),
  };
}

export function snapToGrid(date: Date, gridMinutes = 15): Date {
  const ms = gridMinutes * 60 * 1000;
  return new Date(Math.round(date.getTime() / ms) * ms);
}

export function getBlockTop(start: Date, dayStartHour: number, hourHeight: number): number {
  const minutesFromStart = (start.getHours() - dayStartHour) * 60 + start.getMinutes();
  return (minutesFromStart / 60) * hourHeight;
}

export function getBlockHeight(start: Date, end: Date, hourHeight: number): number {
  const durationMinutes = (end.getTime() - start.getTime()) / 60000;
  return (durationMinutes / 60) * hourHeight;
}