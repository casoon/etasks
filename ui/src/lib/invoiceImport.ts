// @module:billing
// Rechnungspositionen aus Abrechnungsdaten: Projekt-Positionen und erfasste Zeit.
import type { BillingItem, InvoiceLineItem, Project, TimeEntry } from "../domain/types";
import { formatDateDe, toDateKeyFromIso } from "../domain/dateUtils";

const UNIT_BY_TYPE = { hourly: "Stunde", fixed: "Pauschal", unit: "Einheit" } as const;

export function billingItemToLineItem(item: BillingItem, vatRate: number): InvoiceLineItem {
  return {
    id: crypto.randomUUID(),
    name: item.title,
    description: item.description?.trim() ?? "",
    unit: UNIT_BY_TYPE[item.billingType],
    unitPrice: (item.unitPriceCents ?? 0) / 100,
    quantity: item.billingType === "fixed" ? 1 : item.quantity && item.quantity > 0 ? item.quantity : 1,
    vatRate,
    taskIds: [],
  };
}

/** Erfasste Zeit in Stunden, auf Viertelstunden gerundet (mindestens 0,25 h bei Zeit > 0). */
export function minutesToQuarterHours(minutes: number): number {
  if (minutes <= 0) return 0;
  return Math.max(0.25, Math.round(minutes / 15) / 4);
}

export interface TrackedProject {
  projectId: string;
  projectName: string;
  minutes: number;
  tasks: Array<{ taskId: string; minutes: number }>;
}

/** Erfasste Minuten je Projekt des Kunden im Zeitraum [from, to] (nach Starttag des Eintrags). */
export function trackedTimeByProject(
  entries: readonly TimeEntry[],
  taskProjectId: (taskId: string) => string | undefined,
  projects: readonly Pick<Project, "id" | "name" | "clientId">[],
  clientId: string,
  from: string,
  to: string,
): TrackedProject[] {
  const byProject = new Map<string, TrackedProject>();
  for (const entry of entries) {
    if (!entry.durationMinutes || entry.durationMinutes <= 0) continue;
    const day = toDateKeyFromIso(entry.startAt);
    if (!day || (from && day < from) || (to && day > to)) continue;
    const projectId = entry.projectId ?? taskProjectId(entry.taskId);
    const project = projects.find((p) => p.id === projectId);
    if (!project || project.clientId !== clientId) continue;
    const row = byProject.get(project.id) ?? {
      projectId: project.id,
      projectName: project.name,
      minutes: 0,
      tasks: [],
    };
    row.minutes += entry.durationMinutes;
    const taskRow = row.tasks.find((t) => t.taskId === entry.taskId);
    if (taskRow) taskRow.minutes += entry.durationMinutes;
    else row.tasks.push({ taskId: entry.taskId, minutes: entry.durationMinutes });
    byProject.set(project.id, row);
  }
  return [...byProject.values()].sort((a, b) => a.projectName.localeCompare(b.projectName));
}

export function trackedTimeToLineItem(
  row: TrackedProject,
  hourlyRate: number,
  vatRate: number,
  from: string,
  to: string,
): InvoiceLineItem {
  return {
    id: crypto.randomUUID(),
    name: row.projectName,
    description: `Erfasste Zeit${from || to ? ` ${formatDateDe(from)}–${formatDateDe(to)}` : ""}`,
    unit: "Stunde",
    unitPrice: hourlyRate,
    quantity: minutesToQuarterHours(row.minutes),
    vatRate,
    taskIds: [],
  };
}
