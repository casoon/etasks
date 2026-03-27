import type { Task, CalendarBlock, WeeklyGoal, DailyNote, Client, Project, TimeEntry, ProjectTemplate, BillingItem, BillingItemTask, DayPlan } from '../domain/types';
import { storageGet, storageSet, KEYS } from './storage';
import { isTauriAvailable } from './platform';
import { invoke } from '@tauri-apps/api/core';

function dbInvoke(cmd: string, args?: Record<string, unknown>): void {
  if (isTauriAvailable()) invoke(cmd, args).catch(console.error);
}

function withUpdate<T extends { id: string }>(arr: T[], item: T): T[] {
  const idx = arr.findIndex((x) => x.id === item.id);
  return idx >= 0
    ? [...arr.slice(0, idx), item, ...arr.slice(idx + 1)]
    : [...arr, item];
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export function loadTasks(): Task[] { return storageGet<Task[]>(KEYS.tasks) ?? []; }
export function saveTasks(t: Task[]): void { storageSet(KEYS.tasks, t); }
export function upsertTask(task: Task): Task[] {
  const n = withUpdate(loadTasks(), task); saveTasks(n);
  dbInvoke('upsert_task', { task });
  return n;
}
export function deleteTask(id: string): Task[] {
  const n = loadTasks().filter(t => t.id !== id); saveTasks(n);
  dbInvoke('delete_task', { id });
  return n;
}

// ── Calendar Blocks ───────────────────────────────────────────────────────────

export function loadBlocks(): CalendarBlock[] { return storageGet<CalendarBlock[]>(KEYS.blocks) ?? []; }
export function saveBlocks(b: CalendarBlock[]): void { storageSet(KEYS.blocks, b); }
export function upsertBlock(block: CalendarBlock): CalendarBlock[] {
  const n = withUpdate(loadBlocks(), block); saveBlocks(n);
  dbInvoke('upsert_block', { block });
  return n;
}
export function deleteBlock(id: string): CalendarBlock[] {
  const n = loadBlocks().filter(b => b.id !== id); saveBlocks(n);
  dbInvoke('delete_block', { id });
  return n;
}
export function deleteBlockByTaskId(taskId: string): CalendarBlock[] {
  const n = loadBlocks().filter(b => b.taskId !== taskId); saveBlocks(n);
  dbInvoke('delete_blocks_by_task_id', { taskId });
  return n;
}

// ── Weekly Goals ──────────────────────────────────────────────────────────────

export function loadGoals(): WeeklyGoal[] { return storageGet<WeeklyGoal[]>(KEYS.goals) ?? []; }
export function saveGoals(g: WeeklyGoal[]): void { storageSet(KEYS.goals, g); }
export function upsertGoal(goal: WeeklyGoal): WeeklyGoal[] {
  const n = withUpdate(loadGoals(), goal); saveGoals(n);
  dbInvoke('upsert_goal', { goal });
  return n;
}
export function deleteGoal(id: string): WeeklyGoal[] {
  const n = loadGoals().filter(g => g.id !== id); saveGoals(n);
  dbInvoke('delete_goal', { id });
  return n;
}

// ── Daily Notes ───────────────────────────────────────────────────────────────

export function loadNotes(): DailyNote[] { return storageGet<DailyNote[]>(KEYS.notes) ?? []; }
export function saveNotes(n: DailyNote[]): void { storageSet(KEYS.notes, n); }
export function upsertNote(note: DailyNote): DailyNote[] {
  const all = loadNotes();
  const idx = all.findIndex(n => n.date === note.date);
  const next = idx >= 0 ? [...all.slice(0, idx), note, ...all.slice(idx + 1)] : [...all, note];
  saveNotes(next);
  dbInvoke('upsert_note', { note });
  return next;
}

// ── Clients ───────────────────────────────────────────────────────────────────

export function loadClients(): Client[] { return storageGet<Client[]>(KEYS.clients) ?? []; }
export function saveClients(c: Client[]): void { storageSet(KEYS.clients, c); }
export function upsertClient(client: Client): Client[] {
  const n = withUpdate(loadClients(), client); saveClients(n);
  dbInvoke('upsert_client', { client });
  return n;
}
export function deleteClient(id: string): Client[] {
  const n = loadClients().filter(c => c.id !== id); saveClients(n);
  dbInvoke('delete_client', { id });
  return n;
}

// ── Projects ──────────────────────────────────────────────────────────────────

export function loadProjects(): Project[] { return storageGet<Project[]>(KEYS.projects) ?? []; }
export function saveProjects(p: Project[]): void { storageSet(KEYS.projects, p); }
export function upsertProject(project: Project): Project[] {
  const n = withUpdate(loadProjects(), project); saveProjects(n);
  dbInvoke('upsert_project', { project });
  return n;
}
export function deleteProject(id: string): Project[] {
  const n = loadProjects().filter(p => p.id !== id); saveProjects(n);
  dbInvoke('delete_project', { id });
  return n;
}

// ── Time Entries ──────────────────────────────────────────────────────────────

export function loadTimeEntries(): TimeEntry[] { return storageGet<TimeEntry[]>(KEYS.timeEntries) ?? []; }
export function saveTimeEntries(e: TimeEntry[]): void { storageSet(KEYS.timeEntries, e); }
export function upsertTimeEntry(entry: TimeEntry): TimeEntry[] {
  const n = withUpdate(loadTimeEntries(), entry); saveTimeEntries(n);
  dbInvoke('upsert_time_entry', { entry });
  return n;
}
export function deleteTimeEntry(id: string): TimeEntry[] {
  const n = loadTimeEntries().filter(e => e.id !== id); saveTimeEntries(n);
  dbInvoke('delete_time_entry', { id });
  return n;
}

// ── Project Templates ─────────────────────────────────────────────────────────

export function loadCustomTemplates(): ProjectTemplate[] { return storageGet<ProjectTemplate[]>(KEYS.templates) ?? []; }
export function saveCustomTemplates(t: ProjectTemplate[]): void { storageSet(KEYS.templates, t); }
export function upsertTemplate(tpl: ProjectTemplate): ProjectTemplate[] {
  const n = withUpdate(loadCustomTemplates(), tpl); saveCustomTemplates(n);
  dbInvoke('upsert_template', { template: tpl });
  return n;
}
export function deleteTemplate(id: string): ProjectTemplate[] {
  const n = loadCustomTemplates().filter(t => t.id !== id); saveCustomTemplates(n);
  dbInvoke('delete_template', { id });
  return n;
}

// ── Billing Items ──────────────────────────────────────────────────────────────

export function loadBillingItems(): BillingItem[] { return storageGet<BillingItem[]>(KEYS.billingItems) ?? []; }
export function saveBillingItems(b: BillingItem[]): void { storageSet(KEYS.billingItems, b); }
export function upsertBillingItem(item: BillingItem): BillingItem[] {
  const n = withUpdate(loadBillingItems(), item); saveBillingItems(n);
  dbInvoke('upsert_billing_item', { item });
  return n;
}
export function deleteBillingItem(id: string): BillingItem[] {
  const n = loadBillingItems().filter(i => i.id !== id); saveBillingItems(n);
  dbInvoke('delete_billing_item', { id });
  return n;
}

// ── Billing Item Tasks ─────────────────────────────────────────────────────────

export function loadBillingItemTasks(): BillingItemTask[] { return storageGet<BillingItemTask[]>(KEYS.billingItemTasks) ?? []; }
export function saveBillingItemTasks(b: BillingItemTask[]): void { storageSet(KEYS.billingItemTasks, b); }
export function addBillingItemTask(link: BillingItemTask): BillingItemTask[] {
  const all = loadBillingItemTasks();
  if (all.some(l => l.billingItemId === link.billingItemId && l.taskId === link.taskId)) return all;
  const n = [...all, link]; saveBillingItemTasks(n);
  dbInvoke('add_billing_item_task', { billingItemId: link.billingItemId, taskId: link.taskId, createdAt: link.createdAt });
  return n;
}
export function removeBillingItemTask(billingItemId: string, taskId: string): BillingItemTask[] {
  const n = loadBillingItemTasks().filter(l => !(l.billingItemId === billingItemId && l.taskId === taskId));
  saveBillingItemTasks(n);
  dbInvoke('remove_billing_item_task', { billingItemId, taskId });
  return n;
}
export function removeBillingItemTasksByBillingItem(billingItemId: string): BillingItemTask[] {
  const all = loadBillingItemTasks();
  const taskIds = all.filter(l => l.billingItemId === billingItemId).map(l => l.taskId);
  const n = all.filter(l => l.billingItemId !== billingItemId);
  saveBillingItemTasks(n);
  for (const taskId of taskIds) {
    dbInvoke('remove_billing_item_task', { billingItemId, taskId });
  }
  return n;
}

// ── Day Plans ──────────────────────────────────────────────────────────────────

export function loadDayPlans(): DayPlan[] { return storageGet<DayPlan[]>(KEYS.dayPlans) ?? []; }
export function saveDayPlans(d: DayPlan[]): void { storageSet(KEYS.dayPlans, d); }
export function upsertDayPlan(plan: DayPlan): DayPlan[] {
  const all = loadDayPlans();
  const idx = all.findIndex(p => p.date === plan.date);
  const n = idx >= 0 ? [...all.slice(0, idx), plan, ...all.slice(idx + 1)] : [...all, plan];
  saveDayPlans(n);
  dbInvoke('upsert_day_plan', { plan });
  return n;
}
export function getDayPlanByDate(date: string): DayPlan | null {
  return loadDayPlans().find(p => p.date === date) ?? null;
}
