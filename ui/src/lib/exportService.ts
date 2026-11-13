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
import { isTauriAvailable } from "./platform";
import { command } from "@casoon/origin-client";

/** Profilfelder, die nicht in die automatische Tagessicherung gehören. */
const SENSITIVE_PROFILE_FIELDS = ["iban", "tax_id", "bank_name", "bic"] as const;

/** `withoutBankData`: Bank- und Steuerdaten des Profils weglassen (automatische Tagessicherung). */
export async function buildSnapshot(options: { withoutBankData?: boolean } = {}) {
  const tenantMeta = isTauriAvailable() ? await metaAll() : [];
  let profile = $appConfig.get()?.profile ?? null;
  if (profile && options.withoutBankData) {
    profile = { ...profile };
    for (const field of SENSITIVE_PROFILE_FIELDS) delete profile[field];
  }
  return {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    profile,
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

/**
 * Schreibt eine JSON-Datei in den Exportordner und gibt den Pfad zurück; Fehler werden geworfen.
 * Nur im Browser-Modus (ohne Tauri) wird stattdessen ein Download ausgelöst (Rückgabe `null`).
 */
async function saveJson(filename: string, json: string): Promise<string | null> {
  if (isTauriAvailable()) {
    return command<string>("export_to_file", {
      json,
      filename,
      directory: $appConfig.get()?.default_export_dir ?? null,
    });
  }
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return null;
}

export async function exportToFile(): Promise<string | null> {
  const json = JSON.stringify(await buildSnapshot(), null, 2);
  return saveJson(`etasks-export-${workspaceSlug()}-${today()}.json`, json);
}

/**
 * Legt die tägliche Sicherung als `snapshot-<arbeitsbereich>-<datum>.json` im Ordner
 * `Sicherungen` des Exportordners ab (die letzten 14 bleiben) und gibt den Pfad zurück.
 * Ohne Bank- und Steuerdaten des Profils; der manuelle Export enthält das volle Profil.
 */
export async function saveDailySnapshot(): Promise<string> {
  const json = JSON.stringify(await buildSnapshot({ withoutBankData: true }), null, 2);
  const path = await command<string>("save_daily_snapshot", {
    json,
    filename: `snapshot-${workspaceSlug()}-${today()}.json`,
    directory: $appConfig.get()?.default_export_dir ?? null,
  });
  storageSet(KEYS.exportMeta, { lastSnapshotDate: today(), lastSnapshotAt: new Date().toISOString() });
  return path;
}

export async function scheduleDailySnapshot(): Promise<void> {
  if (!isTauriAvailable()) return;
  const meta = storageGet<{ lastSnapshotDate: string }>(KEYS.exportMeta);
  if (meta?.lastSnapshotDate === today()) return;
  try {
    await saveDailySnapshot();
  } catch (e) {
    console.warn("Tägliche Sicherung fehlgeschlagen:", e);
  }
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

/** Pflichtfelder je Liste (Zeichenketten); spiegelt, was `import_snapshot` verlangt. */
const REQUIRED_KEYS: Record<string, string[]> = {
  tasks: ["id"],
  blocks: ["id"],
  goals: ["id"],
  notes: ["date"],
  clients: ["id"],
  projects: ["id"],
  services: ["id"],
  timeEntries: ["id"],
  templates: ["id"],
  billingItems: ["id", "projectId"],
  billingItemTasks: ["billingItemId", "taskId", "createdAt"],
  dayPlans: ["id", "date"],
  invoices: ["id"],
  termine: ["id"],
  weekPlans: ["weekStart"],
};

export type BackupLists = Record<string, unknown[]>;
export type ParsedBackup = { lists: BackupLists } | { error: string };

/**
 * Prüft den Aufbau einer Backup-Datei, bevor irgendetwas geschrieben wird:
 * Version, `data`-Objekt, jede vorhandene Liste ein Array von Objekten mit den Pflichtfeldern.
 */
export function parseBackup(json: string): ParsedBackup {
  let snapshot: any;
  try {
    snapshot = JSON.parse(json);
  } catch {
    return { error: "Die Datei ist kein gültiges JSON." };
  }
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return { error: "Die Datei ist kein eTasks-Backup." };
  }
  if (snapshot.version !== undefined && !/^1(\.|$)/.test(String(snapshot.version))) {
    return { error: `Backup-Version "${snapshot.version}" wird nicht unterstützt.` };
  }
  if (!snapshot.data || typeof snapshot.data !== "object" || Array.isArray(snapshot.data)) {
    return { error: "Die Datei enthält kein Feld \"data\" und ist kein eTasks-Backup." };
  }
  const lists: BackupLists = {};
  for (const [name] of IMPORT_LISTS) {
    const value = snapshot.data[name];
    if (value === undefined || value === null) continue;
    if (!Array.isArray(value)) return { error: `"${name}" ist keine Liste.` };
    for (const [index, item] of value.entries()) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return { error: `"${name}" Eintrag ${index + 1} ist kein Objekt.` };
      }
      for (const key of REQUIRED_KEYS[name]) {
        if (typeof item[key] !== "string" || !item[key]) {
          return { error: `"${name}" Eintrag ${index + 1}: Feld "${key}" fehlt.` };
        }
      }
    }
    lists[name] = value;
  }
  if (Object.keys(lists).length === 0) {
    return { error: "Die Datei enthält keine Daten zum Importieren." };
  }
  return { lists };
}

/** Pro Liste der Datei: Anzahl im aktiven Arbeitsbereich und Anzahl in der Datei. */
export function importSummary(lists: BackupLists): { name: string; current: number; incoming: number }[] {
  return IMPORT_LISTS.filter(([name]) => lists[name]).map(([name, key]) => ({
    name,
    current: storageGet<unknown[]>(key)?.length ?? 0,
    incoming: lists[name].length,
  }));
}

/**
 * Schreibt bereits geprüfte Listen in den aktiven Arbeitsbereich. Fehlende Listen bleiben
 * unberührt; Profil, Rechnungs-/Angebotszähler und Meta werden nie importiert.
 * SQLite wird zuerst geschrieben; der UI-Speicher erst danach aktualisiert.
 */
export async function applyBackup(lists: BackupLists): Promise<void> {
  if (isTauriAvailable()) {
    await command("import_snapshot", { payload: lists });
    await syncFromDatabase();
  } else {
    for (const [name, key] of IMPORT_LISTS) {
      if (lists[name]) storageSet(key, lists[name]);
    }
  }
}

export async function importFromJSON(json: string): Promise<boolean> {
  const parsed = parseBackup(json);
  if ("error" in parsed) return false;
  try {
    await applyBackup(parsed.lists);
    return true;
  } catch {
    return false;
  }
}

/** Sichert den aktuellen Stand des Arbeitsbereichs in den Exportordner, bevor ein Import ihn ersetzt. */
export async function writePreImportBackup(): Promise<string | null> {
  const json = JSON.stringify(await buildSnapshot(), null, 2);
  return saveJson(`etasks-vor-import-${workspaceSlug()}-${today()}.json`, json);
}
