// @core
import { entrySeconds, toDateKeyFromIso } from "../domain/dateUtils";

/** Working window the planning capacity is based on (09:00 to 18:00). */
export const PLANNING_WINDOW_MINUTES = 9 * 60;

interface EntryLike {
  startAt: string;
  endAt?: string | null;
  projectId?: string | null;
  durationSeconds?: number | null;
  durationMinutes?: number | null;
}

/** Seconds of one entry; the running entry counts with its elapsed time. */
export function entryTrackedSeconds(e: EntryLike, nowMs: number): number {
  if (e.endAt) return entrySeconds(e);
  return Math.max(0, Math.round((nowMs - new Date(e.startAt).getTime()) / 1000));
}

/** Tracked seconds on the local day `date`. */
export function trackedSecondsOn(entries: readonly EntryLike[], date: string, nowMs: number): number {
  return entries
    .filter((e) => toDateKeyFromIso(e.startAt) === date)
    .reduce((sum, e) => sum + entryTrackedSeconds(e, nowMs), 0);
}

/** Tracked seconds on `date` per project id (entries without a project are not listed). */
export function trackedSecondsByProject(
  entries: readonly EntryLike[],
  date: string,
  nowMs: number,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of entries) {
    if (!e.projectId || toDateKeyFromIso(e.startAt) !== date) continue;
    map.set(e.projectId, (map.get(e.projectId) ?? 0) + entryTrackedSeconds(e, nowMs));
  }
  return map;
}

/** Minutes of the day not taken by appointments. */
export function taskCapacityMinutes(terminMinutes: number): number {
  return Math.max(0, PLANNING_WINDOW_MINUTES - terminMinutes);
}

/** `h:mm:ss` for the running timer. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
