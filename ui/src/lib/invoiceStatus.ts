// @module:billing
// Statuswechsel von Rechnungen: gleiche Prüfung für „Gesendet“ und „Bezahlt“.
import type { Invoice, InvoiceStatus } from "../domain/types";

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
