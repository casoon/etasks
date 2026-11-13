// @module:reporting
// Bericht-Seite: Zeilen aus Aufgaben, Zeit und Terminen, Zeitraum-Schnellwahl und Kopiertext.
import type { Client, Project, Task, TimeEntry, Termin } from '../domain/types';
import { formatDateDe, getWeekRange, toDateKey, addDaysToKey } from '../domain/dateUtils';
import { buildReportRows, buildTerminRows } from './reportService';

export interface ViewRow {
  key: string;
  isTermin: boolean;
  title: string;
  done: boolean;
  projectName: string;
  clientName: string;
  projectColor: string;
  completedDate: string;
  trackedMinutes: number;
  estimatedMinutes: number;
}

export interface ReportFilter {
  from: string;
  to: string;
  /** Leer = alle Kunden. */
  clientId: string;
  /** Leer = alle Projekte. */
  projectId: string;
}

export function buildViewRows(
  data: {
    tasks: readonly Task[];
    timeEntries: readonly TimeEntry[];
    termine: readonly Termin[];
    projects: readonly Project[];
    clients: readonly Client[];
  },
  filter: ReportFilter,
): ViewRow[] {
  const projectMap = new Map(data.projects.map((p) => [p.id, p]));
  const clientMap = new Map(data.clients.map((c) => [c.id, c]));
  const inScope = (projectId: string | undefined) => {
    if (filter.projectId && projectId !== filter.projectId) return false;
    if (filter.clientId) {
      const proj = projectId ? projectMap.get(projectId) : null;
      if (!proj || proj.clientId !== filter.clientId) return false;
    }
    return true;
  };
  return [
    ...buildReportRows(data.tasks, data.timeEntries, filter.from, filter.to, inScope),
    ...buildTerminRows(data.termine, filter.from, filter.to, inScope),
  ]
    .sort((a, b) => a.completedDate.localeCompare(b.completedDate))
    .map((r): ViewRow => {
      const proj = r.projectId ? projectMap.get(r.projectId) : null;
      const client = proj?.clientId ? clientMap.get(proj.clientId) : null;
      return {
        key: r.taskId,
        isTermin: !!r.terminTitle,
        title: r.terminTitle ? `Termin: ${r.terminTitle}` : (r.task?.title ?? 'Gelöschte Aufgabe'),
        done: r.done,
        projectName: proj?.name ?? '—',
        clientName: client?.name ?? '—',
        projectColor: proj?.color ?? '#6366f1',
        completedDate: r.completedDate,
        trackedMinutes: r.trackedMinutes,
        estimatedMinutes: r.estimatedMinutes,
      };
    });
}

export function reportTotals(rows: readonly ViewRow[]) {
  const termine = rows.filter((r) => r.isTermin);
  return {
    count: rows.length,
    trackedMinutes: rows.reduce((s, r) => s + r.trackedMinutes, 0),
    estimatedMinutes: rows.reduce((s, r) => s + r.estimatedMinutes, 0),
    terminCount: termine.length,
    terminMinutes: termine.reduce((s, r) => s + r.trackedMinutes, 0),
  };
}

/** `1 h 30 min`, `45 min`, `2 h`; `—` ohne Zeit. */
export function formatDuration(minutes: number): string {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export type PeriodPreset = 'week' | 'last-week' | 'month' | 'custom';

export function presetRange(preset: Exclude<PeriodPreset, 'custom'>, now: Date): { from: string; to: string } {
  if (preset === 'month') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toDateKey(first), to: toDateKey(now) };
  }
  const anchor = preset === 'week' ? now : new Date(`${addDaysToKey(getWeekRange(now).start, -1)}T12:00:00`);
  const { start, end } = getWeekRange(anchor);
  // „Diese Woche“ reicht bis heute, „Letzte Woche“ bis Sonntag.
  return { from: start, to: preset === 'week' ? toDateKey(now) : end };
}

export function detectPreset(from: string, to: string, now: Date): PeriodPreset {
  for (const p of ['week', 'last-week', 'month'] as const) {
    const r = presetRange(p, now);
    if (r.from === from && r.to === to) return p;
  }
  return 'custom';
}

/** Leistungszeitraum für Rechnungen: `01.–12.11.2026` im selben Monat, sonst beide Daten. */
export function periodLabel(from: string, to: string): string {
  if (from === to) return formatDateDe(from);
  if (from.slice(0, 7) === to.slice(0, 7)) return `${formatDateDe(from).slice(0, 3)}–${formatDateDe(to)}`;
  return `${formatDateDe(from)}–${formatDateDe(to)}`;
}

/** Tätigkeitsbericht als Text, je Projekt gruppiert. */
export function reportText(
  rows: readonly ViewRow[],
  clientName: string | null,
  from: string,
  to: string,
): string {
  const header =
    `${clientName ? `Tätigkeitsbericht für ${clientName}` : 'Tätigkeitsbericht'}\n` +
    `Zeitraum: ${formatDateDe(from)} – ${formatDateDe(to)}\n\n`;
  const grouped = new Map<string, ViewRow[]>();
  for (const row of rows) grouped.set(row.projectName, [...(grouped.get(row.projectName) ?? []), row]);

  let body = '';
  for (const [projectName, projectRows] of grouped) {
    body += `${projectName}\n`;
    for (const row of projectRows) {
      const dur = row.trackedMinutes ? ` (${formatDuration(row.trackedMinutes)})` : '';
      body += `  • ${formatDateDe(row.completedDate)}  ${row.title}${row.done ? '' : ' [offen]'}${dur}\n`;
    }
    const projectMinutes = projectRows.reduce((s, r) => s + r.trackedMinutes, 0);
    if (projectMinutes) body += `  Gesamt: ${formatDuration(projectMinutes)}\n`;
    body += '\n';
  }
  body += `Gesamtaufwand: ${formatDuration(rows.reduce((s, r) => s + r.trackedMinutes, 0))}`;
  return header + body;
}
