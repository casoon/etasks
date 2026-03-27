import { atom, computed } from 'nanostores';
import type { BillingItem, BillingItemTask } from '../domain/types';
import { $tasks } from './taskStore';
import {
  loadBillingItems, upsertBillingItem, deleteBillingItem as dbDeleteBillingItem,
  loadBillingItemTasks, addBillingItemTask, removeBillingItemTask,
  removeBillingItemTasksByBillingItem,
} from '../lib/db';

export const $billingItems = atom<BillingItem[]>([]);
export const $billingItemTasks = atom<BillingItemTask[]>([]);

export function initBillingItems(): void {
  $billingItems.set(loadBillingItems());
  $billingItemTasks.set(loadBillingItemTasks());
}

export function addBillingItem(
  projectId: string,
  data: Pick<BillingItem, 'title' | 'billingType'> & Partial<Pick<BillingItem, 'description' | 'serviceId' | 'unitPriceCents' | 'quantity'>>,
): BillingItem {
  const now = new Date().toISOString();
  const existing = $billingItems.get().filter(i => i.projectId === projectId);
  const item: BillingItem = {
    id: crypto.randomUUID(),
    projectId,
    title: data.title,
    billingType: data.billingType,
    description: data.description ?? null,
    serviceId: data.serviceId ?? null,
    unitPriceCents: data.unitPriceCents ?? null,
    quantity: data.quantity ?? null,
    sortOrder: existing.length,
    createdAt: now,
    updatedAt: now,
  };
  $billingItems.set(upsertBillingItem(item));
  return item;
}

export function updateBillingItem(id: string, patch: Partial<Omit<BillingItem, 'id' | 'createdAt'>>): void {
  const item = $billingItems.get().find(i => i.id === id);
  if (!item) return;
  $billingItems.set(upsertBillingItem({ ...item, ...patch, updatedAt: new Date().toISOString() }));
}

export function removeBillingItem(id: string): void {
  $billingItems.set(dbDeleteBillingItem(id));
  $billingItemTasks.set(removeBillingItemTasksByBillingItem(id));
}

export function linkTaskToBillingItem(billingItemId: string, taskId: string): void {
  const link: BillingItemTask = {
    billingItemId,
    taskId,
    createdAt: new Date().toISOString(),
  };
  $billingItemTasks.set(addBillingItemTask(link));
}

export function unlinkTaskFromBillingItem(billingItemId: string, taskId: string): void {
  $billingItemTasks.set(removeBillingItemTask(billingItemId, taskId));
}

// Computed: billing item IDs where all linked tasks are done (and at least one linked)
export const $unlockedBillingItemIds = computed(
  [$billingItems, $billingItemTasks, $tasks],
  (items, links, tasks) =>
    items
      .filter(item => {
        const linked = links.filter(l => l.billingItemId === item.id).map(l => l.taskId);
        return linked.length > 0 && linked.every(id => tasks.find(t => t.id === id)?.status === 'done');
      })
      .map(item => item.id),
);
