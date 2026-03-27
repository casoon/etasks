import { atom } from 'nanostores';
import type { ServiceItem } from '../domain/types';
import { storageGet, storageSet, KEYS } from '../lib/storage';
import { isTauriAvailable } from '../lib/platform';
import { invoke } from '@tauri-apps/api/core';

function dbInvoke(cmd: string, args?: Record<string, unknown>): void {
  if (isTauriAvailable()) invoke(cmd, args).catch(console.error);
}

function loadServices(): ServiceItem[] {
  return storageGet<ServiceItem[]>(KEYS.services) ?? [];
}

function persist(items: ServiceItem[]): ServiceItem[] {
  storageSet(KEYS.services, items);
  return items;
}

export const $services = atom<ServiceItem[]>(loadServices());

export function initServices(): void {
  $services.set(loadServices());
}

export function addService(draft: Omit<ServiceItem, 'id' | 'createdAt'>): ServiceItem {
  const item: ServiceItem = {
    ...draft,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  $services.set(persist([...$services.get(), item]));
  dbInvoke('upsert_service', { service: item });
  return item;
}

export function updateService(id: string, patch: Partial<Omit<ServiceItem, 'id' | 'createdAt'>>): void {
  const updated = $services.get().map((s) => (s.id === id ? { ...s, ...patch } : s));
  $services.set(persist(updated));
  const item = updated.find(s => s.id === id);
  if (item) dbInvoke('upsert_service', { service: item });
}

export function removeService(id: string): void {
  $services.set(persist($services.get().filter((s) => s.id !== id)));
  dbInvoke('delete_service', { id });
}
