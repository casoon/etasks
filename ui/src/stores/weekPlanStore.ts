// @module:planning
import { atom, computed } from 'nanostores';
import type { WeekPlan } from '../domain/types';
import { getWeekStart } from '../domain/dateUtils';
import { loadWeekPlans, upsertWeekPlan } from '../lib/db';

export const $weekPlans = atom<WeekPlan[]>([]);

export const $currentWeekPlan = computed($weekPlans, (plans): WeekPlan => {
  const weekStart = getWeekStart(new Date());
  return plans.find((p) => p.weekStart === weekStart) ?? { weekStart, focusProjectIds: [] };
});

export function initWeekPlans(): void {
  $weekPlans.set(loadWeekPlans());
}

export function setFocusProjects(weekStart: string, projectIds: string[]): void {
  const existing = $weekPlans.get().find((p) => p.weekStart === weekStart) ?? { weekStart, focusProjectIds: [] };
  $weekPlans.set(upsertWeekPlan({ ...existing, focusProjectIds: projectIds }));
}

export function setOutcomeNote(weekStart: string, note: string): void {
  const existing = $weekPlans.get().find((p) => p.weekStart === weekStart) ?? { weekStart, focusProjectIds: [] };
  $weekPlans.set(upsertWeekPlan({ ...existing, outcomeNote: note }));
}