import { atom } from 'nanostores';
import type { ServiceItem } from '../domain/types';

const STORAGE_KEY = 'etasks_service_catalog';

function loadServices(): ServiceItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ServiceItem[]) : [];
  } catch {
    return [];
  }
}

function persist(items: ServiceItem[]): ServiceItem[] {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
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
  return item;
}

export function updateService(id: string, patch: Partial<Omit<ServiceItem, 'id' | 'createdAt'>>): void {
  const updated = $services.get().map((s) => (s.id === id ? { ...s, ...patch } : s));
  $services.set(persist(updated));
}

export function removeService(id: string): void {
  $services.set(persist($services.get().filter((s) => s.id !== id)));
}
