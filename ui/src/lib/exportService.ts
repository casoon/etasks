import { loadTasks, loadBlocks, loadGoals, loadNotes, loadClients, loadProjects, loadTimeEntries } from './db';
import { storageGet, storageSet, KEYS } from './storage';
import { today } from '../domain/dateUtils';
import { isTauriAvailable } from './platform';
import { invoke } from '@tauri-apps/api/core';

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

  if (isTauriAvailable()) {
    try {
      await invoke('export_to_file', { json, filename });
      return;
    } catch {
      // Fallback auf Browser-Download
    }
  }

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function saveToICloud(): Promise<void> {
  if (!isTauriAvailable()) return;

  const snapshot = buildSnapshot();
  const json = JSON.stringify(snapshot, null, 2);
  const filename = `snapshot-${today()}.json`;

  try {
    await invoke('save_to_icloud', { json, filename });
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
