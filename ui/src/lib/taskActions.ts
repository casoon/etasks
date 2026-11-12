// @core
import { $tasks, removeTask } from '../stores/taskStore';
import { $blocks, removeBlock, removeBlockForTask } from '../stores/calendarStore';
import { $activeEntry, stopActiveTimer, removeTimeEntriesWhere } from '../stores/timerStore';
import { $billingItems, removeBillingItem, removeTaskLinks } from '../stores/billingStore';
import { removeTermineWhere } from '../stores/terminStore';
import { $projects, removeProject, removeClient } from '../stores/projectStore';

// Delete a task together with its calendar blocks and billing item links and stop a timer
// running on it. Time entries stay: they are recorded work, the views label them
// "Gelöschte Aufgabe".
export function deleteTaskCascade(id: string): void {
  if ($activeEntry.get()?.taskId === id) stopActiveTimer();
  removeBlockForTask(id);
  removeTaskLinks(id);
  removeTask(id);
}

// Remove calendar blocks of tasks that no longer exist or are not scheduled any more
// (left over from before blocks were removed together with scheduledStart). Blocks without
// a task are free entries and stay.
export function removeOrphanedBlocks(): void {
  const tasks = new Map($tasks.get().map((t) => [t.id, t]));
  for (const block of $blocks.get()) {
    if (!block.taskId) continue;
    const task = tasks.get(block.taskId);
    if (!task || !task.scheduledStart) removeBlock(block.id);
  }
}

// Delete a project with everything that belongs to it: tasks, their time entries,
// billing items (with links) and appointments. Invoices are kept.
export function deleteProjectCascade(projectId: string): void {
  const taskIds = new Set($tasks.get().filter((t) => t.projectId === projectId).map((t) => t.id));
  for (const id of taskIds) deleteTaskCascade(id);
  removeTimeEntriesWhere((e) => taskIds.has(e.taskId) || e.projectId === projectId);
  for (const item of $billingItems.get().filter((i) => i.projectId === projectId)) {
    removeBillingItem(item.id);
  }
  removeTermineWhere((t) => t.projectId === projectId);
  removeProject(projectId);
}

// Delete a client with all its projects (see deleteProjectCascade) and its appointments.
// Invoices are kept with their clientId; the invoice list shows them without a client.
export function deleteClientCascade(clientId: string): void {
  for (const p of $projects.get().filter((p) => p.clientId === clientId)) {
    deleteProjectCascade(p.id);
  }
  removeTermineWhere((t) => t.clientId === clientId);
  removeClient(clientId);
}
