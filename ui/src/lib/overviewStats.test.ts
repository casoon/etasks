import { describe, expect, it } from 'vitest';
import type { Client, Invoice, Project, Task, TimeEntry } from '../domain/types';
import { activeProjectRows, openInvoiceRows, overdueNote, taskTile, timeTodayTile, todayRows, weekTile } from './overviewStats';

const DAY = '2026-11-12';
const now = new Date(2026, 10, 12, 12, 0).getTime();
const at = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m).toISOString();
const task = (patch: Partial<Task>): Task => ({ id: 'x', title: 'x', status: 'todo', tags: [], createdAt: '', updatedAt: '', plannedDate: DAY, ...patch });
const entry = (startAt: string, seconds: number): TimeEntry => ({ id: startAt, taskId: 't', startAt, endAt: startAt, durationSeconds: seconds, isRunning: false, updatedAt: '' });
const project = (patch: Partial<Project>): Project => ({ id: 'p', clientId: 'c', name: 'P', color: '#2456D6', status: 'active', createdAt: '', ...patch });
const client: Client = { id: 'c', name: 'Hansen' } as Client;
const invoice = (patch: Partial<Invoice>): Invoice => ({
  id: 'i', clientId: 'c', invoiceNumber: 'RE-1', date: '2026-11-01', dueDate: '2026-11-15', status: 'sent', lineItems: [], createdAt: '', ...patch,
});

describe('overviewStats', () => {
  it('counts open and done tasks of the day, ignoring templates and other days', () => {
    const tasks = [
      task({ id: 'a', status: 'done' }),
      task({ id: 'b' }),
      task({ id: 'c' }),
      task({ id: 'd', plannedDate: '2026-11-13' }),
      task({ id: 'e', recurrence: { weekdays: [1] } }),
    ];
    expect(taskTile(tasks, DAY)).toEqual({ value: '2 offen', note: '1 von 3 erledigt', percent: 33 });
  });

  it('compares tracked time today with estimates, without a bar when nothing is planned', () => {
    const tasks = [task({ estimatedMinutes: 120 })];
    const entries = [entry(at(12, 9), 3600)];
    expect(timeTodayTile(tasks, entries, DAY, now)).toEqual({ value: '1 h', note: 'von 2 h geplant', percent: 50 });
    expect(timeTodayTile([], entries, DAY, now).percent).toBeNull();
  });

  it('sums the whole week Monday to Sunday', () => {
    const tasks = [task({ estimatedMinutes: 60 }), task({ plannedDate: '2026-11-10', estimatedMinutes: 60 })];
    const entries = [entry(at(9, 9), 1800), entry(at(12, 9), 1800), entry(at(16, 9), 3600)];
    expect(weekTile(tasks, entries, DAY, now)).toEqual({ value: '1 h', note: 'erfasst · 2 h geplant', percent: 50 });
  });

  it('orders the day: running, scheduled by time, unscheduled, done', () => {
    const projects = [project({ id: 'p', name: 'Relaunch' })];
    const rows = todayRows(
      [
        task({ id: 'done', status: 'done' }),
        task({ id: 'free', estimatedMinutes: 30 }),
        task({ id: 'late', scheduledStart: at(12, 14), estimatedMinutes: 45 }),
        task({ id: 'early', scheduledStart: at(12, 11), priorityRank: 1, projectId: 'p', estimatedMinutes: 60 }),
        task({ id: 'run' }),
      ],
      projects,
      DAY,
      'run',
    );
    expect(rows.map((r) => r.id)).toEqual(['run', 'early', 'late', 'free', 'done']);
    expect(rows[0].hint).toBe('läuft');
    expect(rows[1]).toMatchObject({ subtitle: 'Top 3 · Relaunch', state: 'scheduled' });
    expect(rows[3]).toMatchObject({ state: 'unscheduled', hint: '30 min' });
  });

  it('lists active projects with overdue first and limits the count', () => {
    const projects = [
      project({ id: 'a', name: 'Alpha' }),
      project({ id: 'b', name: 'Beta', deadline: '2026-11-10' }),
      project({ id: 'c', name: 'Gamma', status: 'paused' }),
    ];
    const tasks = [task({ projectId: 'b', status: 'done' }), task({ projectId: 'b' })];
    const rows = activeProjectRows(projects, [client], tasks, [], DAY, now, 4);
    expect(rows.map((r) => r.id)).toEqual(['b', 'a']);
    expect(rows[0]).toMatchObject({ done: 1, total: 2, percent: 50, deadlineState: 'overdue', clientName: 'Hansen' });
    expect(activeProjectRows(projects, [client], tasks, [], DAY, now, 1)).toHaveLength(1);
  });

  it('lists unpaid invoices overdue, sent, draft and describes the overdue ones', () => {
    const invoices = [
      invoice({ id: 'd', status: 'draft' }),
      invoice({ id: 's' }),
      invoice({ id: 'o', dueDate: '2026-11-08' }),
      invoice({ id: 'p', status: 'paid' }),
    ];
    expect(openInvoiceRows(invoices, [client], DAY).map((r) => [r.id, r.status])).toEqual([
      ['o', 'overdue'],
      ['s', 'sent'],
      ['d', 'draft'],
    ]);
    expect(overdueNote(invoices, DAY)).toBe('1 überfällig seit 4 Tagen');
    expect(overdueNote([invoice({})], DAY)).toBeNull();
  });
});
