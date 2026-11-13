// @module:projects
import type { Client, Invoice, Project, Task, TimeEntry } from '../domain/types';
import { entryTrackedSeconds } from './dayStats';
import { entryProjectId } from './timeWeek';
import { displayStatus, invoiceGrossCents } from './invoiceStatus';

export interface ClientStats {
  projectCount: number;
  activeProjectCount: number;
  trackedMinutes: number;
  openCents: number;
  overdueCents: number;
  overdueCount: number;
  draftCount: number;
  paidCents: number;
  paidCount: number;
}

/** Kennzahlen eines Kunden: Projekte, erfasste Zeit und Rechnungen (offen = gesendet, nicht bezahlt). */
export function clientStats(
  clientId: string,
  projects: readonly Pick<Project, 'id' | 'clientId' | 'status'>[],
  tasks: readonly Task[],
  entries: readonly TimeEntry[],
  invoices: readonly Pick<Invoice, 'clientId' | 'status' | 'dueDate' | 'lineItems'>[],
  todayKey: string,
  nowMs: number,
): ClientStats {
  const own = projects.filter((p) => p.clientId === clientId);
  const ids = new Set(own.map((p) => p.id));
  const seconds = entries
    .filter((e) => {
      const pid = entryProjectId(e, tasks);
      return !!pid && ids.has(pid);
    })
    .reduce((sum, e) => sum + entryTrackedSeconds(e, nowMs), 0);
  const stats: ClientStats = {
    projectCount: own.length,
    activeProjectCount: own.filter((p) => p.status === 'active').length,
    trackedMinutes: Math.round(seconds / 60),
    openCents: 0,
    overdueCents: 0,
    overdueCount: 0,
    draftCount: 0,
    paidCents: 0,
    paidCount: 0,
  };
  for (const inv of invoices) {
    if (inv.clientId !== clientId) continue;
    const gross = invoiceGrossCents(inv);
    if (inv.status === 'draft') stats.draftCount++;
    else if (inv.status === 'paid') {
      stats.paidCents += gross;
      stats.paidCount++;
    } else {
      stats.openCents += gross;
      if (displayStatus(inv, todayKey) === 'overdue') {
        stats.overdueCents += gross;
        stats.overdueCount++;
      }
    }
  }
  return stats;
}

/** Suche nach Name, Ansprechpartner oder Kundennummer. */
export function filterClients<T extends Pick<Client, 'name' | 'contactPerson' | 'customerNumber'>>(
  clients: readonly T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...clients];
  return clients.filter((c) =>
    [c.name, c.contactPerson, c.customerNumber].some((v) => v?.toLowerCase().includes(q)),
  );
}

/** Schrift auf einer Kundenfarbe: dunkel auf hellen, weiß auf dunklen Flächen (Kontrast ≥ 4,5:1). */
export function textOnColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#FFFFFF';
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // White gives (1.05)/(lum+0.05); dark #1C1B19 (lum ≈ 0.011) gives (lum+0.05)/0.061.
  return 1.05 / (lum + 0.05) >= 4.5 ? '#FFFFFF' : '#1C1B19';
}
