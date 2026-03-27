import { isTauriAvailable } from './platform';
import { invoke } from '@tauri-apps/api/core';

const memoryFallback = new Map<string, string>();

function isLocalStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/**
 * Sync all keys from the open SQLite DB into localStorage.
 * Called once after db_open() so all existing store code continues
 * to work against localStorage without modification.
 */
export async function syncFromDatabase(): Promise<void> {
  if (!isTauriAvailable()) return;
  try {
    const keys = await invoke<string[]>('db_all_keys');
    for (const key of keys) {
      const raw = await invoke<string | null>('db_get', { key });
      if (raw !== null && isLocalStorageAvailable()) {
        localStorage.setItem(key, raw);
      }
    }
  } catch (e) {
    console.warn('syncFromDatabase fehlgeschlagen:', e);
  }
}

export function storageGet<T>(key: string): T | null {
  try {
    const raw = isLocalStorageAvailable()
      ? localStorage.getItem(key)
      : (memoryFallback.get(key) ?? null);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function storageSet<T>(key: string, value: T): void {
  const raw = JSON.stringify(value);
  if (isLocalStorageAvailable()) {
    localStorage.setItem(key, raw);
  } else {
    memoryFallback.set(key, raw);
  }
  // Mirror to SQLite (fire-and-forget)
  if (isTauriAvailable()) {
    invoke('db_set', { key, value: raw }).catch(console.error);
  }
}

export function storageRemove(key: string): void {
  if (isLocalStorageAvailable()) {
    localStorage.removeItem(key);
  } else {
    memoryFallback.delete(key);
  }
  if (isTauriAvailable()) {
    invoke('db_remove', { key }).catch(console.error);
  }
}

export const KEYS = {
  tasks: 'etasks:tasks',
  blocks: 'etasks:blocks',
  goals: 'etasks:goals',
  notes: 'etasks:notes',
  clients: 'etasks:clients',
  projects: 'etasks:projects',
  timeEntries: 'etasks:timeEntries',
  templates: 'etasks:templates',
  exportMeta: 'etasks:exportMeta',
} as const;
