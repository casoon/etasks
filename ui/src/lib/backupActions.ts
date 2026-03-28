import { importFromJSON, exportToFile, saveToICloud } from "./exportService";
import { reinitStores } from "./storeInit";
import { toast } from "../stores/toastStore";
import { isTauriAvailable } from "./platform";

export async function runExportWithFeedback(): Promise<void> {
  try {
    await exportToFile();
    toast("Backup exportiert.", "success");
  } catch (error) {
    toast(`Export fehlgeschlagen: ${String(error)}`, "error", 4500);
  }
}

export async function runSnapshotWithFeedback(): Promise<void> {
  if (!isTauriAvailable()) {
    toast(
      "iCloud-Snapshots sind nur in der Desktop-App verfügbar.",
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

export async function restoreFromBackupFile(file: File): Promise<boolean> {
  try {
    const json = await file.text();
    const ok = await importFromJSON(json);
    if (!ok) {
      toast("Backup-Datei konnte nicht gelesen werden.", "error", 4500);
      return false;
    }
    reinitStores();
    toast("Backup importiert.", "success");
    return true;
  } catch (error) {
    toast(`Import fehlgeschlagen: ${String(error)}`, "error", 4500);
    return false;
  }
}
