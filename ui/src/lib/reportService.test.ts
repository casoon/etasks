import { describe, expect, it, vi } from 'vitest';

vi.mock('@casoon/origin-client', () => ({ command: vi.fn() }));
vi.mock('../stores/configStore', () => ({ $appConfig: { get: () => null } }));

import { buildProjectReportInput, buildReportRows } from './reportService';
import type { Project, Task, TimeEntry } from '../domain/types';

const task = (o: Partial<Task>): Task =>
  ({ id: 't', title: 'T', status: 'backlog', tags: [], createdAt: '2026-01-01T10:00:00', updatedAt: '2026-01-01T10:00:00', ...o }) as Task;
const entry = (o: Partial<TimeEntry>): TimeEntry =>
  ({ id: 'e', taskId: 't', startAt: '2026-03-10T10:00:00', endAt: '2026-03-10T11:00:00', durationMinutes: 60, isRunning: false, updatedAt: '', ...o }) as TimeEntry;
const all = () => true;

describe('buildReportRows', () => {
  it('dates completion by completedAt, not updatedAt', () => {
    const t = task({ status: 'done', completedAt: '2026-02-10T12:00:00', updatedAt: '2026-03-15T12:00:00' });
    expect(buildReportRows([t], [], '2026-03-01', '2026-03-31', all)).toHaveLength(0);
    const rows = buildReportRows([t], [], '2026-02-01', '2026-02-28', all);
    expect(rows[0].completedDate).toBe('2026-02-10');
  });

  it('does not use the estimate as tracked time', () => {
    const t = task({ status: 'done', completedAt: '2026-03-10T12:00:00', estimatedMinutes: 30 });
    const [row] = buildReportRows([t], [], '2026-03-01', '2026-03-31', all);
    expect(row.trackedMinutes).toBe(0);
    expect(row.estimatedMinutes).toBe(30);
  });

  it('attributes time by the entry day and includes open tasks', () => {
    const t = task({ status: 'done', completedAt: '2026-03-20T12:00:00' });
    const open = task({ id: 'o' });
    const entries = [
      entry({ startAt: '2026-02-20T10:00:00', durationMinutes: 45 }),
      entry({ id: 'e2', startAt: '2026-03-10T10:00:00', durationMinutes: 60 }),
      entry({ id: 'e3', taskId: 'o', startAt: '2026-03-11T10:00:00', durationMinutes: 15 }),
    ];
    const rows = buildReportRows([t, open], entries, '2026-03-01', '2026-03-31', all);
    expect(rows.find((r) => r.taskId === 't')!.trackedMinutes).toBe(60);
    const o = rows.find((r) => r.taskId === 'o')!;
    expect(o.done).toBe(false);
    expect(o.trackedMinutes).toBe(15);
  });

  it('keeps time of deleted tasks', () => {
    const rows = buildReportRows([], [entry({ taskId: 'gone', projectId: 'p' })], '2026-03-01', '2026-03-31', all);
    expect(rows).toHaveLength(1);
    expect(rows[0].task).toBeNull();
    expect(rows[0].trackedMinutes).toBe(60);
  });
});

describe('buildProjectReportInput', () => {
  const project = { id: 'p', name: 'P', status: 'active' } as Project;
  it('counts time of deleted tasks via entry projectId and reports tracked time per task', () => {
    const t = task({ projectId: 'p', estimatedMinutes: 120 });
    const input = buildProjectReportInput(project, [t], [
      entry({ projectId: 'p' }),
      entry({ id: 'e2', taskId: 'gone', projectId: 'p', durationMinutes: 30 }),
      entry({ id: 'e3', taskId: 'gone2', projectId: 'other', durationMinutes: 30 }),
    ]);
    expect(input.tracked_hours).toBeCloseTo(1.5);
    expect(input.planned_hours).toBe(2);
    expect(input.tasks[0].duration_minutes).toBe(60);
  });

  it('never carries the internal project notes into the report', () => {
    const input = buildProjectReportInput({ ...project, notes: 'Zugang: geheim' } as Project, [], []);
    expect(JSON.stringify(input)).not.toContain('geheim');
  });
});
