// @module:calendar
import { atom, computed } from 'nanostores';
import type { CalendarBlock } from '../domain/types';
import { $activeDate } from './taskStore';
import { createBlockFromTask, moveBlock as domainMoveBlock } from '../domain/calendarService';
import { loadBlocks, upsertBlock, deleteBlock as dbDeleteBlock, deleteBlockByTaskId } from '../lib/db';
import type { Task } from '../domain/types';

// ── State ─────────────────────────────────────────────────────────────────────

export const $blocks = atom<CalendarBlock[]>([]);

// ── Derived ──────────────────────────────────────────────────────────────────

export const $todayBlocks = computed([$blocks, $activeDate], (blocks, date) =>
  blocks.filter((b) => b.date === date)
);

// ── Actions ───────────────────────────────────────────────────────────────────

export function initBlocks(): void {
  $blocks.set(loadBlocks());
}

export function dropTaskOnCalendar(task: Task, start: Date): void {
  // Remove existing block for this task if any
  const existing = $blocks.get().find((b) => b.taskId === task.id);
  let next = $blocks.get();

  if (existing) {
    next = next.filter((b) => b.id !== existing.id);
  }

  const block = createBlockFromTask(task, start);
  const saved = upsertBlock(block);
  $blocks.set(saved);
}

export function moveBlock(id: string, newStart: Date): void {
  const block = $blocks.get().find((b) => b.id === id);
  if (!block) return;
  $blocks.set(upsertBlock(domainMoveBlock(block, newStart)));
}

export function removeBlock(id: string): void {
  $blocks.set(dbDeleteBlock(id));
}

export function removeBlockForTask(taskId: string): void {
  $blocks.set(deleteBlockByTaskId(taskId));
}