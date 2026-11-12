// @core
import {
  loadTasks,
  loadBlocks,
  loadGoals,
  loadNotes,
  loadClients,
  loadProjects,
  loadTimeEntries,
  loadCustomTemplates,
  loadBillingItems,
  loadBillingItemTasks,
  loadDayPlans,
  loadTermine,
  loadWeekPlans,
} from "./db";
import { storageGet, storageSet, syncFromDatabase, KEYS } from "./storage";
import { $bridgeServices as $services, $bridgeInvoices as $invoices } from "../stores/coreBridge";
import { $appConfig } from "../stores/configStore";
import { metaAll } from "./metaStore";
import { today } from "../domain/dateUtils";
import { isTauriAvailable, isMac } from "./platform";
import { command } from "@casoon/origin-client";

export async function buildSnapshot() {
  const tenantMeta = isTauriAvailable() ? await metaAll() : [];
  return {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    profile: $appConfig.get()?.profile ?? null,
    tenantMeta,
    data: {
      tasks: loadTasks(),
      blocks: loadBlocks(),
      goals: loadGoals(),
      notes: loadNotes(),
      clients: loadClients(),
      projects: loadProjects(),
      services: $services.get(),
      timeEntries: loadTimeEntries(),
      templates: loadCustomTemplates(),
      billingItems: loadBillingItems(),
      billingItemTasks: loadBillingItemTasks(),
      dayPlans: loadDayPlans(),
      invoices: $invoices.get(),
      termine: loadTermine(),
      weekPlans: loadWeekPlans(),
    },
  };
}

/** File-name safe slug of the active workspace, so workspaces never share a file. */
function workspaceSlug(): string {
  const config = $appConfig.get();
  const tenant = config?.tenants?.find((t) => t.path === config.active_tenant);
  const name = tenant?.displayName || tenant?.name || "";
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "arbeitsbereich";
}

export async function exportToFile(): Promise<void> {
  const snapshot = await buildSnapshot();
  const json = JSON.stringify(snapshot, null, 2);
  const filename = `etasks-export-${workspaceSlug()}-${today()}.json`;

  if (isTauriAvailable()) {
    try {
      await command("export_to_file", {
        json,
        filename,
        directory: $appConfig.get()?.default_export_dir ?? null,
      });
      return;
    } catch {
      // Fallback auf Browser-Download
    }
  }

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function saveToICloud(): Promise<boolean> {
  if (!isTauriAvailable() || !isMac()) return false;

  const snapshot = await buildSnapshot();
  const json = JSON.stringify(snapshot, null, 2);
  const filename = `snapshot-${workspaceSlug()}-${today()}.json`;

  try {
    await command("save_to_icloud", { json, filename });
    storageSet(KEYS.exportMeta, { lastSnapshotDate: today() });
    return true;
  } catch (e) {
    console.warn("iCloud sync fehlgeschlagen:", e);
    return false;
  }
}

export async function scheduleDailySnapshot(): Promise<void> {
  if (!isTauriAvailable() || !isMac()) return;
  const meta = storageGet<{ lastSnapshotDate: string }>(KEYS.exportMeta);
  if (meta?.lastSnapshotDate === today()) return;
  await saveToICloud();
}

const IMPORT_LISTS = [
  ["tasks", KEYS.tasks],
  ["blocks", KEYS.blocks],
  ["goals", KEYS.goals],
  ["notes", KEYS.notes],
  ["clients", KEYS.clients],
  ["projects", KEYS.projects],
  ["services", KEYS.services],
  ["timeEntries", KEYS.timeEntries],
  ["templates", KEYS.templates],
  ["billingItems", KEYS.billingItems],
  ["billingItemTasks", KEYS.billingItemTasks],
  ["dayPlans", KEYS.dayPlans],
  ["invoices", KEYS.invoices],
  ["termine", KEYS.termine],
  ["weekPlans", KEYS.weekPlans],
] as const;

/**
 * Imports the data lists of a backup into the active workspace. Lists missing
 * from the file stay untouched. Profile, invoice/offer counters and workspace
 * meta are never imported, so counters cannot be rolled back.
 * SQLite is written first; the UI storage is only refreshed after it succeeded.
 */
export async function importFromJSON(json: string): Promise<boolean> {
  try {
    const snapshot = JSON.parse(json);
    if (!snapshot.data || typeof snapshot.data !== "object") return false;
    const lists: Record<string, unknown[]> = {};
    for (const [name] of IMPORT_LISTS) {
      const value = snapshot.data[name];
      if (value === undefined || value === null) continue;
      if (!Array.isArray(value)) return false;
      lists[name] = value;
    }
    if (isTauriAvailable()) {
      await command("import_snapshot", { payload: lists });
      await syncFromDatabase();
    } else {
      for (const [name, key] of IMPORT_LISTS) {
        if (lists[name]) storageSet(key, lists[name]);
      }
    }
    return true;
  } catch {
    return false;
  }
}
