import { isTauriAvailable } from "./platform";
import { invoke } from "@tauri-apps/api/core";

const memoryFallback = new Map<string, string>();

function isLocalStorageAvailable(): boolean {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function isEntityBackedKey(key: string): boolean {
  return ENTITY_BACKED_KEYS.has(key);
}

/**
 * Sync all entity tables from the open SQLite DB into localStorage.
 * Called once after db_open() so all existing store code continues
 * to work against localStorage without modification.
 */
export async function syncFromDatabase(): Promise<void> {
  if (!isTauriAvailable()) return;
  try {
    const entityLoads: Array<[string, string]> = [
      ["list_tasks", KEYS.tasks],
      ["list_projects", KEYS.projects],
      ["list_clients", KEYS.clients],
      ["list_services", KEYS.services],
      ["list_billing_items", KEYS.billingItems],
      ["list_billing_item_tasks", KEYS.billingItemTasks],
      ["list_time_entries", KEYS.timeEntries],
      ["list_day_plans", KEYS.dayPlans],
      ["list_blocks", KEYS.blocks],
      ["list_goals", KEYS.goals],
      ["list_notes", KEYS.notes],
      ["list_templates", KEYS.templates],
      ["list_invoices", KEYS.invoices],
    ];
    const results = await Promise.all(
      entityLoads.map(([cmd]) => invoke<unknown[]>(cmd).catch(() => null)),
    );
    if (isLocalStorageAvailable()) {
      for (let i = 0; i < entityLoads.length; i++) {
        const rows = results[i];
        if (rows !== null) {
          localStorage.setItem(entityLoads[i][1], JSON.stringify(rows));
        }
      }
    }
    // Also load legacy KV keys not covered by entity tables
    const keys = await invoke<string[]>("db_all_keys");
    for (const key of keys) {
      if (isEntityBackedKey(key)) continue;
      const raw = await invoke<string | null>("db_get", { key });
      if (raw !== null && isLocalStorageAvailable()) {
        localStorage.setItem(key, raw);
      }
    }
  } catch (e) {
    console.warn("syncFromDatabase fehlgeschlagen:", e);
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
  // Only legacy key/value state belongs in the KV table.
  if (isTauriAvailable() && !isEntityBackedKey(key)) {
    invoke("db_set", { key, value: raw }).catch(console.error);
  }
}

export function storageRemove(key: string): void {
  if (isLocalStorageAvailable()) {
    localStorage.removeItem(key);
  } else {
    memoryFallback.delete(key);
  }
  if (isTauriAvailable() && !isEntityBackedKey(key)) {
    invoke("db_remove", { key }).catch(console.error);
  }
}

export const KEYS = {
  tasks: "etasks:tasks",
  blocks: "etasks:blocks",
  goals: "etasks:goals",
  notes: "etasks:notes",
  clients: "etasks:clients",
  projects: "etasks:projects",
  timeEntries: "etasks:timeEntries",
  templates: "etasks:templates",
  exportMeta: "etasks:exportMeta",
  billingItems: "etasks:billingItems",
  billingItemTasks: "etasks:billingItemTasks",
  dayPlans: "etasks:dayPlans",
  services: "etasks:services",
  invoices: "etasks:invoices",
} as const;

const ENTITY_BACKED_KEYS = new Set<string>([
  KEYS.tasks,
  KEYS.blocks,
  KEYS.goals,
  KEYS.notes,
  KEYS.clients,
  KEYS.projects,
  KEYS.timeEntries,
  KEYS.templates,
  KEYS.billingItems,
  KEYS.billingItemTasks,
  KEYS.dayPlans,
  KEYS.services,
  KEYS.invoices,
]);
