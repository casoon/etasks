import { describe, it, expect } from 'vitest';
import {
  createBlockFromTask,
  moveBlock,
  resizeBlock,
  snapToGrid,
  getBlockTop,
  getBlockHeight,
} from './calendarService';
import type { Task } from './types';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test task',
    duration: 60,
    status: 'todo',
    tags: [],
    date: '2026-03-27',
    createdAt: new Date().toISOString(),
    order: 1,
    ...overrides,
  };
}

describe('createBlockFromTask', () => {
  it('creates a block spanning task.duration minutes', () => {
    const task = makeTask({ duration: 90 });
    const start = new Date('2026-03-27T09:00:00Z');
    const block = createBlockFromTask(task, start);

    const startMs = new Date(block.start).getTime();
    const endMs = new Date(block.end).getTime();
    expect(endMs - startMs).toBe(90 * 60 * 1000);
  });

  it('links block to task via taskId', () => {
    const task = makeTask({ id: 'abc123' });
    const block = createBlockFromTask(task, new Date());
    expect(block.taskId).toBe('abc123');
  });

  it('copies task title', () => {
    const task = makeTask({ title: 'Deploy prod' });
    const block = createBlockFromTask(task, new Date());
    expect(block.title).toBe('Deploy prod');
  });
});

describe('moveBlock', () => {
  const block = {
    id: 'b1',
    title: 'Meeting',
    start: '2026-03-27T09:00:00.000Z',
    end: '2026-03-27T10:00:00.000Z',
    date: '2026-03-27',
  };

  it('moves start to newStart', () => {
    const newStart = new Date('2026-03-27T11:00:00.000Z');
    const moved = moveBlock(block, newStart);
    expect(moved.start).toBe(newStart.toISOString());
  });

  it('preserves block duration', () => {
    const newStart = new Date('2026-03-27T14:00:00.000Z');
    const moved = moveBlock(block, newStart);
    const durMs = new Date(moved.end).getTime() - new Date(moved.start).getTime();
    expect(durMs).toBe(60 * 60 * 1000);
  });

  it('preserves other fields', () => {
    const moved = moveBlock(block, new Date());
    expect(moved.id).toBe(block.id);
    expect(moved.title).toBe(block.title);
  });
});

describe('resizeBlock', () => {
  it('updates end time only', () => {
    const block = {
      id: 'b1', title: 'T',
      start: '2026-03-27T09:00:00.000Z',
      end: '2026-03-27T10:00:00.000Z',
      date: '2026-03-27',
    };
    const newEnd = new Date('2026-03-27T10:30:00.000Z');
    const resized = resizeBlock(block, newEnd);
    expect(resized.end).toBe(newEnd.toISOString());
    expect(resized.start).toBe(block.start);
  });
});

describe('snapToGrid', () => {
  it('rounds up to the next 15-minute mark', () => {
    const d = new Date('2026-03-27T09:07:00.000Z');
    const snapped = snapToGrid(d);
    expect(snapped.getUTCMinutes()).toBe(0);
    expect(snapped.getUTCHours()).toBe(9);
  });

  it('rounds to nearest 15 minutes (round up)', () => {
    const d = new Date('2026-03-27T09:08:00.000Z');
    const snapped = snapToGrid(d);
    expect(snapped.getUTCMinutes()).toBe(15);
  });

  it('rounds to nearest 15 minutes (round down)', () => {
    const d = new Date('2026-03-27T09:06:00.000Z');
    const snapped = snapToGrid(d);
    expect(snapped.getUTCMinutes()).toBe(0);
  });

  it('respects custom grid size', () => {
    const d = new Date('2026-03-27T09:12:00.000Z');
    const snapped = snapToGrid(d, 30);
    expect(snapped.getUTCMinutes()).toBe(0);
  });
});

describe('getBlockTop', () => {
  it('returns 0 for a block starting exactly at dayStart', () => {
    const start = new Date('2026-03-27T06:00:00');
    expect(getBlockTop(start, 6, 64)).toBe(0);
  });

  it('returns correct pixel offset for 1 hour after dayStart', () => {
    const start = new Date('2026-03-27T07:00:00');
    expect(getBlockTop(start, 6, 64)).toBe(64);
  });

  it('accounts for partial hours', () => {
    const start = new Date('2026-03-27T06:30:00');
    expect(getBlockTop(start, 6, 64)).toBe(32);
  });
});

describe('getBlockHeight', () => {
  it('returns full hourHeight for a 1-hour block', () => {
    const start = new Date('2026-03-27T09:00:00');
    const end = new Date('2026-03-27T10:00:00');
    expect(getBlockHeight(start, end, 64)).toBe(64);
  });

  it('returns half hourHeight for a 30-minute block', () => {
    const start = new Date('2026-03-27T09:00:00');
    const end = new Date('2026-03-27T09:30:00');
    expect(getBlockHeight(start, end, 64)).toBe(32);
  });

  it('returns correct height for a 90-minute block', () => {
    const start = new Date('2026-03-27T09:00:00');
    const end = new Date('2026-03-27T10:30:00');
    expect(getBlockHeight(start, end, 64)).toBe(96);
  });
});
