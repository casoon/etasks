import { describe, expect, it } from 'vitest';
import { clientStats, filterClients, textOnColor } from './clientStats';
import { clientCsvFilename, clientTimeCsv } from './clientCsv';

const projects = [
  { id: 'p1', clientId: 'c1', status: 'active' },
  { id: 'p2', clientId: 'c1', status: 'done' },
  { id: 'p3', clientId: 'c2', status: 'active' },
] as never[];
const tasks = [{ id: 't1', projectId: 'p1', title: 'Layout' }] as never[];
const entries = [
  { id: 'e1', taskId: 't1', startAt: '2026-11-10T08:00:00', endAt: '2026-11-10T09:30:00', durationSeconds: 5400 },
  { id: 'e2', taskId: 'gone', projectId: 'p3', startAt: '2026-11-10T08:00:00', endAt: '2026-11-10T09:00:00', durationSeconds: 3600 },
] as never[];
const item = (unitPrice: number) => ({ unitPrice, quantity: 1, vatRate: 0, taskIds: ['t1'] }) as never;
const invoices = [
  { clientId: 'c1', status: 'sent', dueDate: '2026-11-01', invoiceNumber: 'RE-1', lineItems: [item(100)] },
  { clientId: 'c1', status: 'sent', dueDate: '2026-12-01', invoiceNumber: 'RE-2', lineItems: [item(50)] },
  { clientId: 'c1', status: 'draft', dueDate: '2026-12-01', invoiceNumber: 'RE-3', lineItems: [item(999)] },
  { clientId: 'c1', status: 'paid', dueDate: '2026-10-01', invoiceNumber: 'RE-0', lineItems: [item(70)] },
  { clientId: 'c2', status: 'sent', dueDate: '2026-12-01', invoiceNumber: 'RE-9', lineItems: [item(5)] },
] as never[];

describe('clientStats', () => {
  it('aggregates projects, time and invoices of one client', () => {
    const s = clientStats('c1', projects, tasks, entries, invoices, '2026-11-12', Date.now());
    expect(s).toMatchObject({
      projectCount: 2,
      activeProjectCount: 1,
      trackedMinutes: 90,
      openCents: 15000,
      overdueCents: 10000,
      overdueCount: 1,
      draftCount: 1,
      paidCents: 7000,
      paidCount: 1,
    });
  });
  it('counts time of deleted tasks via the entry project', () => {
    expect(clientStats('c2', projects, tasks, entries, invoices, '2026-11-12', Date.now()).trackedMinutes).toBe(60);
  });
});

describe('filterClients', () => {
  const list = [
    { name: 'Bäckerei Hansen', contactPerson: 'Merle', customerNumber: 'K-12' },
    { name: 'Praxis', contactPerson: undefined, customerNumber: undefined },
  ];
  it('matches name, contact and customer number', () => {
    expect(filterClients(list, 'hans')).toHaveLength(1);
    expect(filterClients(list, 'merle')).toHaveLength(1);
    expect(filterClients(list, 'k-12')).toHaveLength(1);
    expect(filterClients(list, '')).toHaveLength(2);
  });
});

describe('textOnColor', () => {
  it('uses dark text on light colors and white on dark ones', () => {
    expect(textOnColor('#2456D6')).toBe('#FFFFFF');
    expect(textOnColor('#f59e0b')).toBe('#1C1B19');
  });
});

describe('clientTimeCsv', () => {
  it('writes header, rows with invoice per task, BOM and semicolons', () => {
    const csv = clientTimeCsv('Hansen', 'c1', projects, tasks, entries, invoices);
    const lines = csv.replace('﻿', '').split('\n');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Layout');
    // the last invoice listing the task wins; „1,5“ is quoted because of the decimal comma
    expect(lines[1]).toContain('90;"1,5";RE-0;paid');
  });
  it('builds a safe filename', () => {
    expect(clientCsvFilename('Bäckerei Hansen')).toBe('etasks-b-ckerei-hansen-abrechnung.csv');
  });
});
