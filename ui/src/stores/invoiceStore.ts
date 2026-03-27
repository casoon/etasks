import { atom } from 'nanostores';
import type { Invoice } from '../domain/types';
import { storageGet, storageSet, KEYS } from '../lib/storage';
import { isTauriAvailable } from '../lib/platform';
import { invoke } from '@tauri-apps/api/core';

function dbInvoke(cmd: string, args?: Record<string, unknown>): void {
  if (isTauriAvailable()) invoke(cmd, args).catch(console.error);
}

function load(): Invoice[] {
  return storageGet<Invoice[]>(KEYS.invoices) ?? [];
}

function persist(list: Invoice[]): Invoice[] {
  storageSet(KEYS.invoices, list);
  return list;
}

export const $invoices = atom<Invoice[]>(load());

export function initInvoices(): void {
  $invoices.set(load());
}

export function addInvoice(draft: Omit<Invoice, 'id' | 'createdAt'>): Invoice {
  const inv: Invoice = { ...draft, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  const next = persist([...$invoices.get(), inv]);
  $invoices.set(next);
  dbInvoke('upsert_invoice', { invoice: inv });
  return inv;
}

export function updateInvoice(id: string, patch: Partial<Omit<Invoice, 'id' | 'createdAt'>>): void {
  const next = $invoices.get().map(i => i.id === id ? { ...i, ...patch } : i);
  persist(next);
  $invoices.set(next);
  const updated = next.find(i => i.id === id);
  if (updated) dbInvoke('upsert_invoice', { invoice: updated });
}

export function removeInvoice(id: string): void {
  const next = persist($invoices.get().filter(i => i.id !== id));
  $invoices.set(next);
  dbInvoke('delete_invoice', { id });
}
