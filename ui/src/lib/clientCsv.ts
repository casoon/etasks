// @module:projects
import type { Invoice, Project, Task, TimeEntry } from '../domain/types';
import { entrySeconds } from '../domain/dateUtils';
import { csvEscape } from './csv';
import { entryProjectId } from './timeWeek';

const HEADER = ['Kunde', 'Projekt', 'Aufgabe', 'Start', 'Ende', 'Minuten', 'Stunden', 'Rechnung', 'Rechnungsstatus'];

/** Zeiten aller Projekte eines Kunden als CSV (Semikolon, UTF-8-BOM für Excel), mit Rechnung je Aufgabe. */
export function clientTimeCsv(
  clientName: string,
  clientId: string,
  projects: readonly Project[],
  tasks: readonly Task[],
  entries: readonly TimeEntry[],
  invoices: readonly Invoice[],
): string {
  const projectsById = new Map(projects.filter((p) => p.clientId === clientId).map((p) => [p.id, p]));
  const tasksById = new Map(tasks.map((t) => [t.id, t]));
  const invoiceByTaskId = new Map<string, { invoiceNumber: string; status: string }>();
  for (const invoice of invoices.filter((i) => i.clientId === clientId)) {
    for (const lineItem of invoice.lineItems) {
      for (const taskId of lineItem.taskIds) {
        invoiceByTaskId.set(taskId, { invoiceNumber: invoice.invoiceNumber, status: invoice.status });
      }
    }
  }
  const rows = [
    HEADER,
    ...entries
      .filter((e) => {
        const pid = entryProjectId(e, tasks);
        return !!pid && projectsById.has(pid);
      })
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .map((e) => {
        const invoice = invoiceByTaskId.get(e.taskId);
        const seconds = entrySeconds(e);
        return [
          clientName,
          projectsById.get(entryProjectId(e, tasks)!)?.name ?? '',
          tasksById.get(e.taskId)?.title ?? '',
          e.startAt,
          e.endAt ?? '',
          Math.round(seconds / 60),
          (Math.round((seconds / 3600) * 100) / 100).toString().replace('.', ','),
          invoice?.invoiceNumber ?? '',
          invoice?.status ?? '',
        ];
      }),
  ];
  return '﻿' + rows.map((row) => row.map(csvEscape).join(';')).join('\n');
}

export function clientCsvFilename(clientName: string): string {
  return `etasks-${clientName.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}-abrechnung.csv`;
}
