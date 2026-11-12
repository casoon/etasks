import {
  parseBackup,
  importSummary,
  applyBackup,
  writePreImportBackup,
  exportToFile,
  saveToICloud,
} from "./exportService";
import { $appConfig } from "../stores/configStore";
import { reinitStores } from "./storeInit";
import { toast } from "../stores/toastStore";
import { isTauriAvailable, isMac } from "./platform";

export async function runExportWithFeedback(): Promise<void> {
  try {
    await exportToFile();
    toast("Backup exportiert.", "success");
  } catch (error) {
    toast(`Export fehlgeschlagen: ${String(error)}`, "error", 4500);
  }
}

export async function runSnapshotWithFeedback(): Promise<void> {
  if (!isTauriAvailable() || !isMac()) {
    toast(
      "iCloud-Snapshots sind nur in der macOS-Desktop-App verfügbar.",
      "info",
      4000,
    );
    return;
  }

  const ok = await saveToICloud();
  if (ok) {
    toast("Snapshot gespeichert.", "success");
  } else {
    toast("Snapshot konnte nicht gespeichert werden.", "error", 4500);
  }
}

const LIST_LABELS: Record<string, string> = {
  tasks: "Aufgaben",
  blocks: "Kalenderblöcke",
  goals: "Wochenziele",
  notes: "Tagesnotizen",
  clients: "Kunden",
  projects: "Projekte",
  services: "Leistungen",
  timeEntries: "Zeiteinträge",
  templates: "Vorlagen",
  billingItems: "Rechnungspositionen",
  billingItemTasks: "Positions-Verknüpfungen",
  dayPlans: "Tagespläne",
  invoices: "Rechnungen",
  termine: "Termine",
  weekPlans: "Wochenpläne",
};

/**
 * Spielt eine Backup-Datei ein. Gemeinsamer Weg für Einstellungen und rechte Leiste:
 * Datei prüfen, Rückfrage mit Mengen, automatische Sicherung vor dem Import, dann importieren.
 */
export async function restoreFromBackupFile(file: File): Promise<boolean> {
  try {
    const parsed = parseBackup(await file.text());
    if ("error" in parsed) {
      toast(`Backup-Datei ungültig: ${parsed.error}`, "error", 4500);
      return false;
    }

    const config = $appConfig.get();
    const target = isTauriAvailable()
      ? (config?.tenants?.find((t) => t.path === config.active_tenant)?.name ?? "den aktiven Arbeitsbereich")
      : "den aktuellen Browser-Speicher";
    const lines = importSummary(parsed.lists)
      .map((e) => `${LIST_LABELS[e.name] ?? e.name}: ${e.current} vorhanden, ${e.incoming} in der Datei`)
      .join("\n");
    const confirmed = confirm(
      `Backup "${file.name}" in ${target} importieren?\n\nDiese Bereiche werden vollständig ersetzt:\n${lines}\n\nVorher wird automatisch eine Sicherung des aktuellen Stands angelegt.`,
    );
    if (!confirmed) return false;

    let safetyCopy: string | null;
    try {
      safetyCopy = await writePreImportBackup();
    } catch (error) {
      toast(`Import abgebrochen, die Sicherung vor dem Import ist fehlgeschlagen: ${String(error)}`, "error", 6000);
      return false;
    }

    await applyBackup(parsed.lists);
    reinitStores();
    toast(
      safetyCopy ? `Backup importiert. Vorherigen Stand gesichert: ${safetyCopy}` : "Backup importiert.",
      "success",
      6000,
    );
    return true;
  } catch (error) {
    toast(`Import fehlgeschlagen: ${String(error)}`, "error", 4500);
    return false;
  }
}
