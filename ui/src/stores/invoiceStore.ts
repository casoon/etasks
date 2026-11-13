// @module:billing
import { atom } from "nanostores";
import type { Invoice } from "../domain/types";
import {
  loadInvoices,
  upsertInvoice,
  deleteInvoice as dbDeleteInvoice,
} from "../lib/db";
import { $bridgeInvoices } from "./coreBridge";

export const $invoices = atom<Invoice[]>(loadInvoices());
$invoices.subscribe(val => $bridgeInvoices.set(val as Invoice[]));

/** Invoice open in the editor; null shows the list. */
export const $selectedInvoiceId = atom<string | null>(null);

/** Period handed over by „Rechnung aus diesem Zeitraum erstellen“; the editor opens the time import for it once. */
export const $pendingImportRange = atom<{ from: string; to: string } | null>(null);

export function initInvoices(): void {
  $invoices.set(loadInvoices());
}

export function addInvoice(draft: Omit<Invoice, "id" | "createdAt">): Invoice {
  const inv: Invoice = {
    ...draft,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  $invoices.set(upsertInvoice(inv));
  return inv;
}

export function updateInvoice(
  id: string,
  patch: Partial<Omit<Invoice, "id" | "createdAt">>,
): void {
  const invoice = $invoices.get().find((i) => i.id === id);
  if (!invoice) return;
  $invoices.set(upsertInvoice({ ...invoice, ...patch }));
}

export function removeInvoice(id: string): void {
  $invoices.set(dbDeleteInvoice(id));
  if ($selectedInvoiceId.get() === id) $selectedInvoiceId.set(null);
}