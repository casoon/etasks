import { atom } from 'nanostores';
import { $activeDate } from './taskStore';

const dateKey = $activeDate.get();

export const $dailyIntention = atom<string>(
  localStorage.getItem(`intention_${dateKey}`) ?? ''
);

export function setIntention(text: string): void {
  $dailyIntention.set(text);
  localStorage.setItem(`intention_${$activeDate.get()}`, text);
}

function loadMit(): string[] {
  try {
    return JSON.parse(localStorage.getItem(`mit_${dateKey}`) ?? '[]');
  } catch {
    return [];
  }
}

export const $mitTaskIds = atom<string[]>(loadMit());

export function toggleMit(taskId: string): void {
  const current = $mitTaskIds.get();
  let next: string[];
  if (current.includes(taskId)) {
    next = current.filter(id => id !== taskId);
  } else if (current.length < 3) {
    next = [...current, taskId];
  } else {
    return;
  }
  $mitTaskIds.set(next);
  localStorage.setItem(`mit_${$activeDate.get()}`, JSON.stringify(next));
}
