import type { Task, CalendarBlock, WeeklyGoal, DailyNote, Client, Project, TimeEntry, ProjectTemplate } from '../domain/types';
import { storageGet, storageSet, KEYS } from './storage';

function withUpdate<T extends { id: string }>(arr: T[], item: T): T[] {
  const idx = arr.findIndex((x) => x.id === item.id);
  return idx >= 0
    ? [...arr.slice(0, idx), item, ...arr.slice(idx + 1)]
    : [...arr, item];
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export function loadTasks(): Task[] { return storageGet<Task[]>(KEYS.tasks) ?? []; }
export function saveTasks(t: Task[]): void { storageSet(KEYS.tasks, t); }
export function upsertTask(task: Task): Task[] { const n = withUpdate(loadTasks(), task); saveTasks(n); return n; }
export function deleteTask(id: string): Task[] { const n = loadTasks().filter(t => t.id !== id); saveTasks(n); return n; }

// ── Calendar Blocks ───────────────────────────────────────────────────────────

export function loadBlocks(): CalendarBlock[] { return storageGet<CalendarBlock[]>(KEYS.blocks) ?? []; }
export function saveBlocks(b: CalendarBlock[]): void { storageSet(KEYS.blocks, b); }
export function upsertBlock(block: CalendarBlock): CalendarBlock[] { const n = withUpdate(loadBlocks(), block); saveBlocks(n); return n; }
export function deleteBlock(id: string): CalendarBlock[] { const n = loadBlocks().filter(b => b.id !== id); saveBlocks(n); return n; }
export function deleteBlockByTaskId(taskId: string): CalendarBlock[] { const n = loadBlocks().filter(b => b.taskId !== taskId); saveBlocks(n); return n; }

// ── Weekly Goals ──────────────────────────────────────────────────────────────

export function loadGoals(): WeeklyGoal[] { return storageGet<WeeklyGoal[]>(KEYS.goals) ?? []; }
export function saveGoals(g: WeeklyGoal[]): void { storageSet(KEYS.goals, g); }
export function upsertGoal(goal: WeeklyGoal): WeeklyGoal[] { const n = withUpdate(loadGoals(), goal); saveGoals(n); return n; }
export function deleteGoal(id: string): WeeklyGoal[] { const n = loadGoals().filter(g => g.id !== id); saveGoals(n); return n; }

// ── Daily Notes ───────────────────────────────────────────────────────────────

export function loadNotes(): DailyNote[] { return storageGet<DailyNote[]>(KEYS.notes) ?? []; }
export function saveNotes(n: DailyNote[]): void { storageSet(KEYS.notes, n); }
export function upsertNote(note: DailyNote): DailyNote[] {
  const all = loadNotes();
  const idx = all.findIndex(n => n.date === note.date);
  const next = idx >= 0 ? [...all.slice(0, idx), note, ...all.slice(idx + 1)] : [...all, note];
  saveNotes(next);
  return next;
}

// ── Clients ───────────────────────────────────────────────────────────────────

export function loadClients(): Client[] { return storageGet<Client[]>(KEYS.clients) ?? []; }
export function saveClients(c: Client[]): void { storageSet(KEYS.clients, c); }
export function upsertClient(client: Client): Client[] { const n = withUpdate(loadClients(), client); saveClients(n); return n; }
export function deleteClient(id: string): Client[] { const n = loadClients().filter(c => c.id !== id); saveClients(n); return n; }

// ── Projects ──────────────────────────────────────────────────────────────────

export function loadProjects(): Project[] { return storageGet<Project[]>(KEYS.projects) ?? []; }
export function saveProjects(p: Project[]): void { storageSet(KEYS.projects, p); }
export function upsertProject(project: Project): Project[] { const n = withUpdate(loadProjects(), project); saveProjects(n); return n; }
export function deleteProject(id: string): Project[] { const n = loadProjects().filter(p => p.id !== id); saveProjects(n); return n; }

// ── Time Entries ──────────────────────────────────────────────────────────────

export function loadTimeEntries(): TimeEntry[] { return storageGet<TimeEntry[]>(KEYS.timeEntries) ?? []; }
export function saveTimeEntries(e: TimeEntry[]): void { storageSet(KEYS.timeEntries, e); }
export function upsertTimeEntry(entry: TimeEntry): TimeEntry[] { const n = withUpdate(loadTimeEntries(), entry); saveTimeEntries(n); return n; }
export function deleteTimeEntry(id: string): TimeEntry[] { const n = loadTimeEntries().filter(e => e.id !== id); saveTimeEntries(n); return n; }

// ── Project Templates ─────────────────────────────────────────────────────────

export function loadCustomTemplates(): ProjectTemplate[] { return storageGet<ProjectTemplate[]>(KEYS.templates) ?? []; }
export function saveCustomTemplates(t: ProjectTemplate[]): void { storageSet(KEYS.templates, t); }
export function upsertTemplate(tpl: ProjectTemplate): ProjectTemplate[] { const n = withUpdate(loadCustomTemplates(), tpl); saveCustomTemplates(n); return n; }
export function deleteTemplate(id: string): ProjectTemplate[] { const n = loadCustomTemplates().filter(t => t.id !== id); saveCustomTemplates(n); return n; }
