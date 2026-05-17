// @module:time-tracking
import { atom } from 'nanostores';
import type { Termin, TerminType } from '../domain/types';
import { loadTermine, upsertTermin, deleteTermin as dbDeleteTermin } from '../lib/db';

export const $termine = atom<Termin[]>([]);

export function initTermine(): void {
  $termine.set(loadTermine());
}

export function addTermin(fields: {
  date: string;
  startTime: string;
  durationMinutes: number;
  type: TerminType;
  title: string;
  clientId?: string;
  projectId?: string;
  notes?: string;
  billable: boolean;
}): Termin {
  const now = new Date().toISOString();
  const termin: Termin = {
    id: crypto.randomUUID(),
    ...fields,
    createdAt: now,
    updatedAt: now,
  };
  $termine.set(upsertTermin(termin));
  return termin;
}

export function updateTermin(id: string, patch: Partial<Termin>): void {
  const termin = $termine.get().find((t) => t.id === id);
  if (!termin) return;
  $termine.set(upsertTermin({ ...termin, ...patch, updatedAt: new Date().toISOString() }));
}

export function removeTermin(id: string): void {
  $termine.set(dbDeleteTermin(id));
}