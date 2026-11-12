import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, unknown>();
vi.mock('./storage', () => ({
  KEYS: new Proxy({}, { get: (_t, k) => `etasks:${String(k)}` }),
  storageGet: (key: string) => storage.get(key) ?? null,
  storageSet: (key: string, value: unknown) => void storage.set(key, value),
  reportDbWriteError: () => {},
}));
vi.mock('./platform', () => ({ isTauriAvailable: () => false, isMac: () => true }));
vi.mock('@casoon/origin-client', () => ({ command: vi.fn() }));
vi.mock('./timerService', () => ({ startTimer: vi.fn(), stopTimer: vi.fn() }));
vi.mock('../stores/coreBridge', () => ({
  $bridgeTimeEntries: { set: () => {}, get: () => [] },
  $bridgeInvoices: { set: () => {}, get: () => [] },
}));

import { $tasks } from '../stores/taskStore';
import { $timeEntries } from '../stores/timerStore';
import { $billingItems, $billingItemTasks, $unlockedBillingItemIds } from '../stores/billingStore';
import { $termine } from '../stores/terminStore';
import { $clients, $projects } from '../stores/projectStore';
import { deleteClientCascade, deleteProjectCascade, deleteTaskCascade } from './taskActions';

const now = '2026-03-10T10:00:00.000Z';
const task = (id: string, projectId: string, status = 'todo') =>
  ({ id, title: id, projectId, status, tags: [], createdAt: now, updatedAt: now }) as never;
const item = (id: string, projectId: string) =>
  ({ id, projectId, title: id, billingType: 'fixed', sortOrder: 0, createdAt: now, updatedAt: now }) as never;
const termin = (id: string, o: object) =>
  ({ id, date: '2026-03-10', startTime: '10:00', durationMinutes: 30, type: 'meeting', title: id, billable: false, createdAt: now, updatedAt: now, ...o }) as never;

function seed<T>(atom: { set: (v: T) => void }, key: string, value: T) {
  storage.set(`etasks:${key}`, value);
  atom.set(value);
}

beforeEach(() => {
  storage.clear();
  seed($clients, 'clients', [{ id: 'c1', name: 'C1' }, { id: 'c2', name: 'C2' }] as never);
  seed($projects, 'projects', [{ id: 'p1', clientId: 'c1' }, { id: 'p2', clientId: 'c2' }] as never);
  seed($tasks, 'tasks', [task('t1', 'p1'), task('t2', 'p1', 'done'), task('t3', 'p2')]);
  seed($timeEntries, 'timeEntries', [
    { id: 'e1', taskId: 't1', projectId: 'p1' },
    { id: 'e2', taskId: 't3', projectId: 'p2' },
  ] as never);
  seed($billingItems, 'billingItems', [item('b1', 'p1'), item('b2', 'p2')]);
  seed($billingItemTasks, 'billingItemTasks', [
    { billingItemId: 'b1', taskId: 't1', createdAt: now },
    { billingItemId: 'b1', taskId: 't2', createdAt: now },
  ]);
  seed($termine, 'termine', [termin('m1', { projectId: 'p1' }), termin('m2', { clientId: 'c1' }), termin('m3', { clientId: 'c2' })]);
});

describe('deleteTaskCascade', () => {
  it('removes billing item links so the item can become billable', () => {
    deleteTaskCascade('t1');
    expect($billingItemTasks.get().map((l) => l.taskId)).toEqual(['t2']);
    expect($unlockedBillingItemIds.get()).toEqual(['b1']);
  });
});

describe('deleteProjectCascade', () => {
  it('removes tasks, time entries, billing items, links and appointments of the project only', () => {
    deleteProjectCascade('p1');
    expect($projects.get().map((p) => p.id)).toEqual(['p2']);
    expect($tasks.get().map((t) => t.id)).toEqual(['t3']);
    expect($timeEntries.get().map((e) => e.id)).toEqual(['e2']);
    expect($billingItems.get().map((i) => i.id)).toEqual(['b2']);
    expect($billingItemTasks.get()).toEqual([]);
    expect($termine.get().map((t) => t.id)).toEqual(['m2', 'm3']);
  });
});

describe('deleteClientCascade', () => {
  it('removes the client with its projects and appointments', () => {
    deleteClientCascade('c1');
    expect($clients.get().map((c) => c.id)).toEqual(['c2']);
    expect($projects.get().map((p) => p.id)).toEqual(['p2']);
    expect($tasks.get().map((t) => t.id)).toEqual(['t3']);
    expect($termine.get().map((t) => t.id)).toEqual(['m3']);
  });
});
