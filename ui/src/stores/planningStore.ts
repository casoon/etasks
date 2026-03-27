import { atom, computed } from 'nanostores';
import { $activeDate, $tasks, updateTask } from './taskStore';
import { upsertDayPlan, getDayPlanByDate, loadDayPlans } from '../lib/db';

// ── Daily Intention via DayPlan ──────────────────────────────────────────────

export const $dayPlans = atom(loadDayPlans());

export const $dailyIntention = computed([$dayPlans, $activeDate], (plans, date) =>
  plans.find(p => p.date === date)?.intention ?? ''
);

export function setIntention(text: string): void {
  const date = $activeDate.get();
  const existing = getDayPlanByDate(date);
  const now = new Date().toISOString();
  const plan = existing
    ? { ...existing, intention: text, updatedAt: now }
    : { id: crypto.randomUUID(), date, intention: text, createdAt: now, updatedAt: now };
  $dayPlans.set(upsertDayPlan(plan));
}

// ── MIT (Most Important Tasks) via priorityRank ─────────────────────────────

export const $mitTaskIds = computed([$tasks, $activeDate], (tasks, date) =>
  tasks
    .filter(t => t.plannedDate === date && t.priorityRank != null)
    .sort((a, b) => (a.priorityRank ?? 0) - (b.priorityRank ?? 0))
    .map(t => t.id)
);

export function toggleMit(taskId: string): void {
  const tasks = $tasks.get();
  const date = $activeDate.get();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  if (task.priorityRank != null) {
    updateTask(taskId, { priorityRank: null });
  } else {
    const usedRanks = tasks
      .filter(t => t.plannedDate === date && t.priorityRank != null && t.id !== taskId)
      .map(t => t.priorityRank as number);
    if (usedRanks.length >= 3) return;
    const rank = ([1, 2, 3] as const).find(r => !usedRanks.includes(r)) ?? null;
    if (rank) updateTask(taskId, { priorityRank: rank });
  }
}
