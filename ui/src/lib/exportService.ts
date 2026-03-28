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
} from "./db";
import { storageGet, storageSet, KEYS } from "./storage";
import { $services } from "../stores/serviceStore";
import { $invoices } from "../stores/invoiceStore";
import { $appConfig, saveAppConfig } from "../stores/configStore";
import { metaAll } from "./metaStore";
import { today } from "../domain/dateUtils";
import { isTauriAvailable } from "./platform";
import { invoke } from "@tauri-apps/api/core";

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
    },
  };
}

export async function exportToFile(): Promise<void> {
  const snapshot = await buildSnapshot();
  const json = JSON.stringify(snapshot, null, 2);
  const filename = `etasks-export-${today()}.json`;

  if (isTauriAvailable()) {
    try {
      await invoke("export_to_file", { json, filename });
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
  if (!isTauriAvailable()) return false;

  const snapshot = await buildSnapshot();
  const json = JSON.stringify(snapshot, null, 2);
  const filename = `snapshot-${today()}.json`;

  try {
    await invoke("save_to_icloud", { json, filename });
    storageSet(KEYS.exportMeta, { lastSnapshotDate: today() });
    return true;
  } catch (e) {
    console.warn("iCloud sync fehlgeschlagen:", e);
    return false;
  }
}

export async function scheduleDailySnapshot(): Promise<void> {
  const meta = storageGet<{ lastSnapshotDate: string }>(KEYS.exportMeta);
  if (meta?.lastSnapshotDate === today()) return;
  await saveToICloud();
}

export async function importFromJSON(json: string): Promise<boolean> {
  try {
    const snapshot = JSON.parse(json);
    if (!snapshot.data) return false;
    const {
      tasks,
      blocks,
      goals,
      notes,
      clients,
      projects,
      services,
      timeEntries,
      templates,
      billingItems,
      billingItemTasks,
      dayPlans,
      invoices,
    } = snapshot.data;
    const profile = snapshot.profile;
    const tenantMeta = Array.isArray(snapshot.tenantMeta)
      ? snapshot.tenantMeta
      : [];
    if (tasks) storageSet(KEYS.tasks, tasks);
    if (blocks) storageSet(KEYS.blocks, blocks);
    if (goals) storageSet(KEYS.goals, goals);
    if (notes) storageSet(KEYS.notes, notes);
    if (clients) storageSet(KEYS.clients, clients);
    if (projects) storageSet(KEYS.projects, projects);
    if (services) storageSet(KEYS.services, services);
    if (timeEntries) storageSet(KEYS.timeEntries, timeEntries);
    if (templates) storageSet(KEYS.templates, templates);
    if (billingItems) storageSet(KEYS.billingItems, billingItems);
    if (billingItemTasks) storageSet(KEYS.billingItemTasks, billingItemTasks);
    if (dayPlans) storageSet(KEYS.dayPlans, dayPlans);
    if (invoices) storageSet(KEYS.invoices, invoices);
    if (isTauriAvailable()) {
      await invoke("import_snapshot", {
        payload: {
          tasks: tasks ?? [],
          blocks: blocks ?? [],
          goals: goals ?? [],
          notes: notes ?? [],
          clients: clients ?? [],
          projects: projects ?? [],
          services: services ?? [],
          timeEntries: timeEntries ?? [],
          templates: templates ?? [],
          billingItems: billingItems ?? [],
          billingItemTasks: billingItemTasks ?? [],
          dayPlans: dayPlans ?? [],
          invoices: invoices ?? [],
          tenantMeta,
        },
      });
    }
    const config = $appConfig.get();
    if (profile && config) {
      await saveAppConfig({ ...config, profile });
    }
    return true;
  } catch {
    return false;
  }
}
