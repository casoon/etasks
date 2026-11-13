import { describe, expect, it } from 'vitest';
import type { Project, Task, TimeEntry } from '../domain/types';
import { deadlineLabel, deadlineState, filterProjects, projectStats } from './projectStats';

const project = (patch: Partial<Project>): Project => ({ id: 'p1', clientId: 'c1', name: 'Relaunch', color: '#000', status: 'active', createdAt: '', ...patch });
const task = (patch: Partial<Task>): Task => ({ id: 't', title: 't', status: 'todo', tags: [], createdAt: '', updatedAt: '', projectId: 'p1', ...patch });

describe('projectStats', () => {
  it('counts tasks without templates and sums tracked minutes', () => {
    const tasks = [
      task({ id: 'a', status: 'done' }),
      task({ id: 'b', kanbanStatus: 'in_progress' }),
      task({ id: 'c' }),
      task({ id: 'd', recurrence: { weekdays: [1] } }),
      task({ id: 'e', projectId: 'p2' }),
    ];
    const entry = (taskId: string, seconds: number): TimeEntry => ({ id: taskId, taskId, startAt: '2026-11-12T08:00:00', endAt: '2026-11-12T09:00:00', durationSeconds: seconds, isRunning: false, updatedAt: '' });
    const stats = projectStats('p1', tasks, [entry('a', 3600), entry('b', 1800), entry('e', 7200)], 0);
    expect(stats).toEqual({ total: 3, done: 1, open: 2, inProgress: 1, trackedMinutes: 90 });
  });
});

describe('deadlines', () => {
  const now = '2026-11-12';
  it('marks overdue and due within 7 days', () => {
    expect(deadlineState(project({ deadline: '2026-11-11' }), now)).toBe('overdue');
    expect(deadlineState(project({ deadline: '2026-11-12' }), now)).toBe('soon');
    expect(deadlineState(project({ deadline: '2026-11-19' }), now)).toBe('soon');
    expect(deadlineState(project({ deadline: '2026-11-20' }), now)).toBe('later');
    expect(deadlineState(project({ deadline: '2026-11-01', status: 'done' }), now)).toBe('later');
    expect(deadlineState(project({}), now)).toBe('none');
  });

  it('labels the deadline', () => {
    expect(deadlineLabel(project({ deadline: '2026-11-18' }), now)).toBe('18.11. · in 6 Tagen');
    expect(deadlineLabel(project({ deadline: '2026-11-13' }), now)).toBe('13.11. · morgen');
    expect(deadlineLabel(project({ deadline: '2026-11-12' }), now)).toBe('12.11. · heute');
    expect(deadlineLabel(project({ deadline: '2026-11-10' }), now)).toBe('10.11. · überfällig');
    expect(deadlineLabel(project({ deadline: '2026-12-18' }), now)).toBe('18.12.');
    expect(deadlineLabel(project({}), now)).toBe('keine');
  });
});

describe('filterProjects', () => {
  const projects = [
    project({ id: 'a', name: 'Zebra' }),
    project({ id: 'b', name: 'Alpha', status: 'paused', clientId: 'c2' }),
    project({ id: 'c', name: 'Mitte', status: 'done', clientId: '' }),
  ];
  const clients = [{ id: 'c1', name: 'Hansen' }, { id: 'c2', name: 'Lindqvist' }];

  it('filters by status and sorts by name', () => {
    expect(filterProjects(projects, clients, 'all', '').map((p) => p.id)).toEqual(['b', 'c', 'a']);
    expect(filterProjects(projects, clients, 'paused', '').map((p) => p.id)).toEqual(['b']);
  });

  it('searches project and client name', () => {
    expect(filterProjects(projects, clients, 'all', 'lind').map((p) => p.id)).toEqual(['b']);
    expect(filterProjects(projects, clients, 'all', 'ZEB').map((p) => p.id)).toEqual(['a']);
  });
});
