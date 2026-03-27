import { atom } from 'nanostores';
import type { Invoice } from '../domain/types';

const STORAGE_KEY = 'etasks_invoices';

function load(): Invoice[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); }
  catch { return []; }
}
function save(list: Invoice[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export const $invoices = atom<Invoice[]>(load());

export function addInvoice(draft: Omit<Invoice, 'id' | 'createdAt'>): Invoice {
  const inv: Invoice = { ...draft, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  const next = [...$invoices.get(), inv];
  $invoices.set(next);
  save(next);
  return inv;
}

export function updateInvoice(id: string, patch: Partial<Omit<Invoice, 'id' | 'createdAt'>>): void {
  const next = $invoices.get().map(i => i.id === id ? { ...i, ...patch } : i);
  $invoices.set(next);
  save(next);
}

export function removeInvoice(id: string): void {
  const next = $invoices.get().filter(i => i.id !== id);
  $invoices.set(next);
  save(next);
}
