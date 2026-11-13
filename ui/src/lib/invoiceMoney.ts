// @module:billing
// Rechnungsbeträge werden in Cent gerechnet, damit Zeilen, Netto und MwSt. exakt zusammenpassen.
import type { InvoiceLineItem } from "../domain/types";

export interface VatEntry {
  rate: number;
  baseCents: number;
  amountCents: number;
}

export interface InvoiceTotals {
  nettoCents: number;
  vatEntries: VatEntry[];
  vatCents: number;
  totalCents: number;
}

export function toCents(amount: number): number {
  return Math.round(amount * 100 + 1e-9);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function formatCents(cents: number): string {
  return fromCents(cents).toFixed(2);
}

/** Zeilenbetrag in Cent: Einzelpreis in Cent mal Menge, einmal gerundet. */
export function lineTotalCents(unitPrice: number, quantity: number): number {
  return Math.round(toCents(unitPrice) * quantity + 1e-9);
}

export function calcInvoiceTotals(
  lineItems: Pick<InvoiceLineItem, "unitPrice" | "quantity" | "vatRate">[],
): InvoiceTotals {
  const bases = new Map<number, number>();
  let nettoCents = 0;
  for (const li of lineItems) {
    const lineCents = lineTotalCents(li.unitPrice, li.quantity);
    nettoCents += lineCents;
    bases.set(li.vatRate, (bases.get(li.vatRate) ?? 0) + lineCents);
  }
  const vatEntries = [...bases.entries()].map(([rate, baseCents]) => ({
    rate,
    baseCents,
    amountCents: Math.round((baseCents * rate) / 100 + 1e-9),
  }));
  const vatCents = vatEntries.reduce((sum, entry) => sum + entry.amountCents, 0);
  return { nettoCents, vatEntries, vatCents, totalCents: nettoCents + vatCents };
}

export function isValidUnitPrice(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function isValidVatRate(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

export function isValidQuantity(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/** „1.951,60 €“ */
export function formatEuro(cents: number): string {
  return `${fromCents(cents).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
