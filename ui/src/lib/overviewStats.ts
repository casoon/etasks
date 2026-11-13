// @module:overview
import type { Client, Invoice, Project, Task, TimeEntry } from '../domain/types';
import { formatHm, formatTime, getWeekStart } from '../domain/dateUtils';
import { trackedSecondsOn } from './dayStats';
import { dayBars, weekDayKeys } from './weekStats';
import { deadlineLabel, deadlineState, projectStats, type DeadlineState } from './projectStats';
import { displayStatus, invoiceGrossCents, type InvoiceDisplayStatus } from './invoiceStatus';

export interface OverviewTile {
  value: string;
  note: string;
  /** 0..100, null when the tile has no bar. */
  percent: number | null;
}

function percentOf(part: number, whole: number): number {
  return whole <= 0 ? 0 : Math.min(100, Math.round((part / whole) * 100));
}

/** Day tile „Aufgaben heute“: open count, done of total. Recurring templates are not tasks of the day. */
export function taskTile(tasks: readonly Task[], date: string): OverviewTile {
  const own = tasks.filter((t) => !t.recurrence && t.plannedDate === date && t.status !== 'archived');
  const done = own.filter((t) => t.status === 'done').length;
  return {
    value: `${own.length - done} offen`,
    note: `${done} von ${own.length} erledigt`,
    percent: percentOf(done, own.length),
  };
}

/** Tile „Zeit heute“: tracked time against the estimates of the day's tasks. */
export function timeTodayTile(tasks: readonly Task[], entries: readonly TimeEntry[], date: string, nowMs: number): OverviewTile {
  const planned = tasks
    .filter((t) => !t.recurrence && t.plannedDate === date)
    .reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0);
  const tracked = Math.round(trackedSecondsOn(entries, date, nowMs) / 60);
  return {
    value: formatHm(tracked),
    note: planned > 0 ? `von ${formatHm(planned)} geplant` : 'nichts geplant',
    percent: planned > 0 ? percentOf(tracked, planned) : null,
  };
}

/** Tile „Diese Woche“: tracked time against the week's estimates. */
export function weekTile(tasks: readonly Task[], entries: readonly TimeEntry[], date: string, nowMs: number): OverviewTile {
  const bars = dayBars(weekDayKeys(getWeekStart(new Date(`${date}T00:00:00`))), tasks, entries, nowMs);
  const tracked = Math.round(bars.reduce((s, b) => s + b.trackedMinutes, 0));
  const planned = bars.reduce((s, b) => s + b.plannedMinutes, 0);
  return {
    value: formatHm(tracked),
    note: planned > 0 ? `erfasst · ${formatHm(planned)} geplant` : 'erfasst',
    percent: planned > 0 ? percentOf(tracked, planned) : null,
  };
}

export interface TodayRow {
  id: string;
  title: string;
  subtitle: string;
  /** „läuft“ for the running task, time slot and duration otherwise, empty for done tasks. */
  hint: string;
  state: 'running' | 'scheduled' | 'unscheduled' | 'done';
}

/** Tasks of the day: running first, then open ones by time slot (unscheduled last), done tasks at the end. */
export function todayRows(
  tasks: readonly Task[],
  projects: readonly Project[],
  date: string,
  runningTaskId: string | null,
): TodayRow[] {
  const rank = (t: Task) =>
    t.id === runningTaskId ? 0 : t.status === 'done' ? 3 : t.scheduledStart ? 1 : 2;
  return tasks
    .filter((t) => !t.recurrence && t.plannedDate === date && t.status !== 'archived')
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (a.scheduledStart ?? '').localeCompare(b.scheduledStart ?? '') ||
        (a.priorityRank ?? 9) - (b.priorityRank ?? 9) ||
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    )
    .map((t) => {
      const state: TodayRow['state'] =
        t.id === runningTaskId ? 'running' : t.status === 'done' ? 'done' : t.scheduledStart ? 'scheduled' : 'unscheduled';
      const project = projects.find((p) => p.id === t.projectId)?.name;
      const subtitle = [t.priorityRank ? 'Top 3' : '', project ?? ''].filter(Boolean).join(' · ');
      const duration = t.estimatedMinutes ? formatHm(t.estimatedMinutes) : '';
      const hint =
        state === 'running'
          ? 'läuft'
          : state === 'done'
            ? ''
            : state === 'scheduled'
              ? [formatTime(t.scheduledStart as string), duration].filter(Boolean).join(' · ')
              : duration;
      return { id: t.id, title: t.title, subtitle, hint, state };
    });
}

export interface ProjectRow {
  id: string;
  name: string;
  color: string;
  clientName: string;
  done: number;
  total: number;
  percent: number;
  trackedLabel: string;
  deadline: string | null;
  deadlineState: DeadlineState;
}

/** Active projects, overdue and soon-due first, then by name; at most `limit`. */
export function activeProjectRows(
  projects: readonly Project[],
  clients: readonly Client[],
  tasks: readonly Task[],
  entries: readonly TimeEntry[],
  todayKey: string,
  nowMs: number,
  limit = 4,
): ProjectRow[] {
  const urgency: Record<DeadlineState, number> = { overdue: 0, soon: 1, later: 2, none: 3 };
  return projects
    .filter((p) => p.status === 'active')
    .map((p) => {
      const stats = projectStats(p.id, tasks, entries, nowMs);
      const state = deadlineState(p, todayKey);
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        clientName: clients.find((c) => c.id === p.clientId)?.name ?? '',
        done: stats.done,
        total: stats.total,
        percent: percentOf(stats.done, stats.total),
        trackedLabel: formatHm(stats.trackedMinutes),
        deadline: p.deadline ? deadlineLabel(p, todayKey) : null,
        deadlineState: state,
      };
    })
    .sort((a, b) => urgency[a.deadlineState] - urgency[b.deadlineState] || a.name.localeCompare(b.name, 'de'))
    .slice(0, limit);
}

export interface OpenInvoiceRow {
  id: string;
  number: string;
  clientName: string;
  status: InvoiceDisplayStatus;
  cents: number;
}

/** Unpaid invoices: overdue first, then sent, then drafts; newest first within a group; at most `limit`. */
export function openInvoiceRows(
  invoices: readonly Invoice[],
  clients: readonly Client[],
  todayKey: string,
  limit = 5,
): OpenInvoiceRow[] {
  const order: Record<InvoiceDisplayStatus, number> = { overdue: 0, sent: 1, draft: 2, paid: 3 };
  return invoices
    .filter((i) => i.status !== 'paid')
    .map((i) => ({ invoice: i, status: displayStatus(i, todayKey) }))
    .sort((a, b) => order[a.status] - order[b.status] || b.invoice.date.localeCompare(a.invoice.date))
    .slice(0, limit)
    .map(({ invoice, status }) => ({
      id: invoice.id,
      number: invoice.invoiceNumber,
      clientName: clients.find((c) => c.id === invoice.clientId)?.name ?? '',
      status,
      cents: invoiceGrossCents(invoice),
    }));
}

/** „1 überfällig seit 4 Tagen“ style note for the invoice tile; oldest overdue invoice decides the days. */
export function overdueNote(invoices: readonly Invoice[], todayKey: string): string | null {
  const overdue = invoices.filter((i) => displayStatus(i, todayKey) === 'overdue');
  if (overdue.length === 0) return null;
  const oldest = overdue.map((i) => i.dueDate).sort()[0];
  const days = Math.round(
    (new Date(`${todayKey}T00:00:00`).getTime() - new Date(`${oldest}T00:00:00`).getTime()) / 86_400_000,
  );
  return `${overdue.length} überfällig seit ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
}
