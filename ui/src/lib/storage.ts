const memoryFallback = new Map<string, string>();

function isAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function storageGet<T>(key: string): T | null {
  try {
    const raw = isAvailable() ? localStorage.getItem(key) : memoryFallback.get(key) ?? null;
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function storageSet<T>(key: string, value: T): void {
  const raw = JSON.stringify(value);
  if (isAvailable()) {
    localStorage.setItem(key, raw);
  } else {
    memoryFallback.set(key, raw);
  }
}

export function storageRemove(key: string): void {
  if (isAvailable()) {
    localStorage.removeItem(key);
  } else {
    memoryFallback.delete(key);
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
