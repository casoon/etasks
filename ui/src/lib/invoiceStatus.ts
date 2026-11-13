// @module:billing
// Statuswechsel von Rechnungen: gleiche Prüfung für „Gesendet“ und „Bezahlt“.
import type { Invoice, InvoiceStatus } from "../domain/types";
import { diffDays, formatDateDe } from "../domain/dateUtils";
import { calcInvoiceTotals } from "./invoiceMoney";

/** Grund, warum die Rechnung nicht auf `target` gesetzt werden darf; leer, wenn erlaubt. */
export function statusBlockedReason(
  invoice: Pick<Invoice, "clientId" | "lineItems">,
  target: InvoiceStatus,
): string {
  if (target === "draft") return "";
  if (!invoice.clientId) return "Wähle zuerst einen Kunden.";
  if (invoice.lineItems.length === 0) return "Füge mindestens eine Position hinzu.";
  return "";
}

/** Zurück auf „Entwurf“ aus „Gesendet“/„Bezahlt“ erst nach Rückfrage. */
export function needsRevertConfirmation(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return to === "draft" && from !== "draft";
}

/** Angezeigter Status: „Überfällig“ ist abgeleitet (gesendet und Fälligkeit vor heute), kein gespeichertes Feld. */
export type InvoiceDisplayStatus = InvoiceStatus | "overdue";

export function displayStatus(
  invoice: Pick<Invoice, "status" | "dueDate">,
  todayKey: string,
): InvoiceDisplayStatus {
  return invoice.status === "sent" && !!invoice.dueDate && invoice.dueDate < todayKey
    ? "overdue"
    : invoice.status;
}

export const DISPLAY_STATUS_LABEL: Record<InvoiceDisplayStatus, string> = {
  draft: "Entwurf",
  sent: "Gesendet",
  overdue: "Überfällig",
  paid: "Bezahlt",
};

export type InvoiceFilter = "open" | "draft" | "sent" | "paid" | "all";

/** „Offen“ = noch nicht bezahlt (Entwürfe und Gesendete); „Gesendet“ schließt Überfällige ein. */
export function matchesFilter(invoice: Pick<Invoice, "status">, filter: InvoiceFilter): boolean {
  if (filter === "all") return true;
  if (filter === "open") return invoice.status !== "paid";
  return invoice.status === filter;
}

export function invoiceGrossCents(invoice: Pick<Invoice, "lineItems">): number {
  return calcInvoiceTotals(invoice.lineItems).totalCents;
}

/** Filter und Suche (Nummer oder Kundenname); neueste Rechnung zuerst. */
export function filterInvoices<T extends Pick<Invoice, "status" | "clientId" | "invoiceNumber" | "date" | "createdAt">>(
  invoices: readonly T[],
  clientName: (clientId: string) => string,
  filter: InvoiceFilter,
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  return invoices
    .filter((i) => matchesFilter(i, filter))
    .filter(
      (i) =>
        !q ||
        i.invoiceNumber.toLowerCase().includes(q) ||
        clientName(i.clientId).toLowerCase().includes(q),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

/** Offener Betrag (gesendet, nicht bezahlt) und Zahl der überfälligen Rechnungen. */
export function openSummary(
  invoices: readonly Pick<Invoice, "status" | "dueDate" | "lineItems">[],
  todayKey: string,
): { openCents: number; overdueCount: number } {
  let openCents = 0;
  let overdueCount = 0;
  for (const i of invoices) {
    if (i.status !== "sent") continue;
    openCents += invoiceGrossCents(i);
    if (displayStatus(i, todayKey) === "overdue") overdueCount++;
  }
  return { openCents, overdueCount };
}

/** Fälligkeitstext der Liste, z. B. „16.11.2026 · in 4 Tagen“; Warnstufe nur bei gesendeten Rechnungen. */
export function dueLabel(
  invoice: Pick<Invoice, "status" | "dueDate">,
  todayKey: string,
): { text: string; state: "overdue" | "plain" } {
  const date = formatDateDe(invoice.dueDate);
  if (invoice.status !== "sent") return { text: date, state: "plain" };
  const days = diffDays(todayKey, invoice.dueDate);
  if (days === null) return { text: date, state: "plain" };
  if (days < 0) return { text: `${date} · seit ${-days} ${days === -1 ? "Tag" : "Tagen"}`, state: "overdue" };
  if (days === 0) return { text: `${date} · heute`, state: "plain" };
  return { text: `${date} · ${days === 1 ? "morgen" : `in ${days} Tagen`}`, state: "plain" };
}

/**
 * Aktiver Schritt der Ablaufleiste (1 Daten prüfen, 2 PDF erzeugen, 3 Als gesendet markieren,
 * 4 Bezahlt); 5 = alles erledigt.
 */
export function invoiceStep(
  invoice: Pick<Invoice, "status" | "pdfPath">,
  checksPass: boolean,
): 1 | 2 | 3 | 4 | 5 {
  if (invoice.status === "paid") return 5;
  if (invoice.status === "sent") return 4;
  if (!checksPass) return 1;
  return invoice.pdfPath ? 3 : 2;
}
