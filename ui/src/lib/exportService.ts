import { loadTasks, loadBlocks, loadGoals, loadNotes, loadClients, loadProjects, loadTimeEntries } from './db';
import { storageGet, storageSet, KEYS } from './storage';
import { today } from '../domain/dateUtils';
import { isNeutralinoAvailable } from './platform';

declare const Neutralino: any;

export function buildSnapshot() {
  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    data: {
      tasks: loadTasks(),
      blocks: loadBlocks(),
      goals: loadGoals(),
      notes: loadNotes(),
      clients: loadClients(),
      projects: loadProjects(),
      timeEntries: loadTimeEntries(),
    },
  };
}

export async function exportToFile(): Promise<void> {
  const snapshot = buildSnapshot();
  const json = JSON.stringify(snapshot, null, 2);
  const filename = `etasks-export-${today()}.json`;

  if (isNeutralinoAvailable()) {
    try {
      const downloadsPath = await Neutralino.os.getPath('downloads');
      await Neutralino.filesystem.writeFile(`${downloadsPath}/${filename}`, json);
      return;
    } catch {
      // Fallback auf Browser-Download
    }
  }

  // Browser-Fallback: Blob-Download
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function saveToICloud(): Promise<void> {
  if (!isNeutralinoAvailable()) return;

  const snapshot = buildSnapshot();
  const json = JSON.stringify(snapshot, null, 2);
  const filename = `snapshot-${today()}.json`;

  try {
    const icloudBase = `${await Neutralino.os.getPath('home')}/Library/Mobile Documents/iCloud~js~neutralino~etasks/Documents`;
    try { await Neutralino.filesystem.createDirectory(icloudBase); } catch { /* already exists */ }
    await Neutralino.filesystem.writeFile(`${icloudBase}/${filename}`, json);
    storageSet(KEYS.exportMeta, { lastSnapshotDate: today() });
  } catch (e) {
    console.warn('iCloud sync fehlgeschlagen:', e);
  }
}

export async function scheduleDailySnapshot(): Promise<void> {
  const meta = storageGet<{ lastSnapshotDate: string }>(KEYS.exportMeta);
  if (meta?.lastSnapshotDate === today()) return;
  await saveToICloud();
}

export function importFromJSON(json: string): boolean {
  try {
    const snapshot = JSON.parse(json);
    if (!snapshot.data) return false;
    const { tasks, blocks, goals, notes, clients, projects, timeEntries } = snapshot.data;
    if (tasks) storageSet(KEYS.tasks, tasks);
    if (blocks) storageSet(KEYS.blocks, blocks);
    if (goals) storageSet(KEYS.goals, goals);
    if (notes) storageSet(KEYS.notes, notes);
    if (clients) storageSet(KEYS.clients, clients);
    if (projects) storageSet(KEYS.projects, projects);
    if (timeEntries) storageSet(KEYS.timeEntries, timeEntries);
    return true;
  } catch {
    return false;
  }
}
