// @module:planning
import { atom, computed } from 'nanostores';
import type { WeeklyGoal } from '../domain/types';
import { getWeekStart } from '../domain/dateUtils';
import { loadGoals, upsertGoal, deleteGoal as dbDeleteGoal } from '../lib/db';

export const $goals = atom<WeeklyGoal[]>([]);

export const $currentWeekGoals = computed($goals, (goals) => {
  const weekStart = getWeekStart(new Date());
  return goals.filter((g) => g.weekStart === weekStart);
});

export function initGoals(): void {
  $goals.set(loadGoals());
}

export function addGoal(title: string): void {
  const goal: WeeklyGoal = {
    id: crypto.randomUUID(),
    title,
    done: false,
    weekStart: getWeekStart(new Date()),
    taskIds: [],
  };
  $goals.set(upsertGoal(goal));
}

export function toggleGoal(id: string): void {
  const goal = $goals.get().find((g) => g.id === id);
  if (!goal) return;
  $goals.set(upsertGoal({ ...goal, done: !goal.done }));
}

export function toggleGoalDay(id: string, date: string): void {
  const goal = $goals.get().find((g) => g.id === id);
  if (!goal) return;
  const days = goal.daysCompleted ?? [];
  const updated = days.includes(date)
    ? days.filter((d) => d !== date)
    : [...days, date];
  $goals.set(upsertGoal({ ...goal, daysCompleted: updated }));
}

export function removeGoal(id: string): void {
  $goals.set(dbDeleteGoal(id));
}