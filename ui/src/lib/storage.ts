// @core
import { isTauriAvailable } from "./platform";
import { command } from "@casoon/origin-client";
import { logger } from "./logger";
import { toast } from "../stores/toastStore";

const memoryFallback = new Map<string, string>();

function isLocalStorageAvailable(): boolean {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function isEntityBackedKey(key: string): boolean {
  return ENTITY_BACKED_KEYS.has(key);
}

// Pure UI preferences that are not tenant data survive a workspace switch.
const UI_PREF_PREFIXES = ["etasks:kanban:", "etasks:planning:"];

function clearTenantData(): void {
  if (!isLocalStorageAvailable()) return;
  const stale: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key?.startsWith("etasks:") &&
      !UI_PREF_PREFIXES.some((p) => key.startsWith(p))
    ) {
      stale.push(key);
    }
  }
  for (const key of stale) localStorage.removeItem(key);
}

/**
 * Sync all entity tables from the open SQLite DB into localStorage.
 * Called once after db_open() so all existing store code continues
 * to work against localStorage without modification.
 *
 * Tenant data of a previously open workspace is cleared first, so nothing
 * leaks into the new one. A failing load is reported, never silently ignored.
 */
export async function syncFromDatabase(): Promise<void> {
  if (!isTauriAvailable()) return;
  clearTenantData();
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
    const results = await Promise.allSettled(
      entityLoads.map(([cmd]) => command<unknown[]>(cmd)),
    );
    const keys = await command<string[]>("db_all_keys");
    const kvRows: Array<[string, string | null]> = [];
    for (const key of keys) {
      if (isEntityBackedKey(key)) continue;
      kvRows.push([key, await command<string | null>("db_get", { key })]);
    }

    if (isLocalStorageAvailable()) {
      const failed: string[] = [];
      for (let i = 0; i < entityLoads.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled") {
          localStorage.setItem(
            entityLoads[i][1],
            JSON.stringify(result.value),
          );
        } else {
          failed.push(entityLoads[i][0]);
          logger.error(`${entityLoads[i][0]} fehlgeschlagen: ${result.reason}`);
        }
      }
      for (const [key, raw] of kvRows) {
        if (raw !== null) localStorage.setItem(key, raw);
      }
      if (failed.length > 0) {
        toast(
          "Daten konnten nicht vollständig geladen werden. Bitte die App neu starten.",
          "error",
          6000,
        );
      }
    }
  } catch (e) {
    logger.error(`syncFromDatabase fehlgeschlagen: ${e}`);
    toast("Daten konnten nicht geladen werden.", "error", 6000);
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
    command("db_set", { key, value: raw }).catch(console.error);
  }
}

export function storageRemove(key: string): void {
  if (isLocalStorageAvailable()) {
    localStorage.removeItem(key);
  } else {
    memoryFallback.delete(key);
  }
  if (isTauriAvailable() && !isEntityBackedKey(key)) {
    command("db_remove", { key }).catch(console.error);
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
  weekPlans: "etasks:weekPlans",
  termine: "etasks:termine",
} as const;

// KEYS.termine is intentionally excluded: no Rust commands exist for it yet.
// Termine use the KV table (db_set/db_get) so data persists in SQLite as a blob.
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