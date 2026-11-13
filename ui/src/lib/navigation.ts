// @core
import type { Invoice } from "../domain/types";
import { toDateKey } from "../domain/dateUtils";

/** Two-letter badge for a name: first letters of the first two words, or the first two letters of a single word. */
export function nameInitials(name: string): string {
  const words = name.split(/[\s\-–_.,&/]+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  const letters = (word: string) => Array.from(word).filter((c) => /[\p{L}\p{N}]/u.test(c));
  if (words.length === 0) return "?";
  const chars =
    words.length > 1 ? [letters(words[0])[0], letters(words[1])[0]] : letters(words[0]).slice(0, 2);
  return chars.join("").toLocaleUpperCase("de-DE");
}

/** Sidebar counter at „Rechnungen“: sent but not yet paid. */
export function unpaidInvoiceCount(invoices: readonly Pick<Invoice, "status">[]): number {
  return invoices.filter((i) => i.status === "sent").length;
}

export interface SnapshotMeta {
  lastSnapshotDate?: string;
  lastSnapshotAt?: string;
}

/** Text after „Gesichert · “ for the sidebar status line; null when no snapshot is known. */
export function snapshotLabel(meta: SnapshotMeta | null, now: Date = new Date()): string | null {
  if (!meta) return null;
  const at = meta.lastSnapshotAt ? new Date(meta.lastSnapshotAt) : null;
  const date = at && !isNaN(at.getTime()) ? toDateKey(at) : (meta.lastSnapshotDate ?? null);
  if (!date) return null;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date === toDateKey(now)) {
    if (!at) return "heute";
    const hh = String(at.getHours()).padStart(2, "0");
    const mm = String(at.getMinutes()).padStart(2, "0");
    return `heute ${hh}:${mm}`;
  }
  if (date === toDateKey(yesterday)) return "gestern";
  const [, month, day] = date.split("-");
  return `${day}.${month}.`;
}
