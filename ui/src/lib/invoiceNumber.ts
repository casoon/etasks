// @module:billing
// Rechnungsnummern: Zähler pro Arbeitsbereich (Tenant-Meta), Vergabe nacheinander.
import { metaGet, metaSet } from "./metaStore";

export const INVOICE_COUNTER_KEY = "invoice.counter";
export const OFFER_COUNTER_KEY = "offer.counter";

export function formatInvoiceNumber(prefix: string, counter: number): string {
  return prefix + String(counter).padStart(3, "0");
}

/**
 * Kleinster Zähler ab `startCounter`, der hinter der höchsten vorhandenen Nummer
 * mit diesem Präfix liegt – nie niedriger als eine bereits vergebene Nummer.
 */
export function nextFreeCounter(
  prefix: string,
  startCounter: number,
  existingNumbers: string[],
): number {
  let counter = Math.max(1, Math.floor(startCounter) || 1);
  for (const number of existingNumbers) {
    const trimmed = number.trim();
    if (!trimmed.startsWith(prefix)) continue;
    const suffix = trimmed.slice(prefix.length);
    if (/^\d+$/.test(suffix)) counter = Math.max(counter, Number(suffix) + 1);
  }
  return counter;
}

export function isInvoiceNumberTaken(number: string, otherNumbers: string[]): boolean {
  const wanted = number.trim().toLowerCase();
  return otherNumbers.some((other) => other.trim().toLowerCase() === wanted);
}

let allocationQueue: Promise<unknown> = Promise.resolve();

/**
 * Vergibt die nächste Rechnungsnummer und speichert den Zähler, bevor die Nummer
 * zurückgegeben wird. Aufrufe laufen nacheinander, auch bei Doppelklick.
 * Ohne gespeicherten Zähler gilt der Profil-Zähler als Startwert, solange der
 * Arbeitsbereich schon Rechnungen hat; ein neuer Arbeitsbereich beginnt bei 1.
 */
export function allocateInvoiceNumber(
  prefix: string,
  profileCounter: number | undefined,
  getExistingNumbers: () => string[],
): Promise<string> {
  const run = allocationQueue.then(async () => {
    const existing = getExistingNumbers();
    const stored = Number.parseInt((await metaGet(INVOICE_COUNTER_KEY)) ?? "", 10);
    const start = Number.isFinite(stored)
      ? stored
      : existing.length > 0
        ? (profileCounter ?? 1)
        : 1;
    const counter = nextFreeCounter(prefix, start, existing);
    await metaSet(INVOICE_COUNTER_KEY, String(counter + 1));
    return formatInvoiceNumber(prefix, counter);
  });
  allocationQueue = run.catch(() => undefined);
  return run;
}

/**
 * Nächste Angebotsnummer des Arbeitsbereichs, ohne den Zähler zu verbrauchen: erst
 * nach erfolgreicher PDF-Erzeugung mit {@link commitOfferCounter} speichern.
 * Ohne gespeicherten Zähler gilt der Profil-Zähler (bestehende Nutzer) als Startwert.
 */
export async function peekOfferNumber(
  prefix: string,
  profileCounter: number | undefined,
): Promise<{ number: string; next: number }> {
  const stored = Number.parseInt((await metaGet(OFFER_COUNTER_KEY)) ?? "", 10);
  const start = Number.isFinite(stored) ? stored : (profileCounter ?? 1);
  const counter = Math.max(1, Math.floor(start) || 1);
  return { number: formatInvoiceNumber(prefix, counter), next: counter + 1 };
}

export function commitOfferCounter(next: number): Promise<void> {
  return metaSet(OFFER_COUNTER_KEY, String(next));
}
