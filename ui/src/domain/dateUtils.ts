// @core
export function toDateKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export function today(): string {
  return toDateKey(new Date());
}

export function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return toDateKey(d);
}

/** Kalenderwoche (Montag bis Sonntag) um `date` als Datumsschlüssel, beide Grenzen inklusive. */
export function getWeekRange(date: Date): { start: string; end: string } {
  const start = getWeekStart(date);
  const d = new Date(`${start}T00:00:00`);
  d.setDate(d.getDate() + 6);
  return { start, end: toDateKey(d) };
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** `2026-11-12` → `12.11.2026`; Werte ohne ISO-Datum bleiben unverändert. */
export function formatDateDe(dateStr: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr ?? '');
  return match ? `${match[3]}.${match[2]}.${match[1]}` : (dateStr ?? '');
}

export function formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatTrackedTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Dauer eines Zeiteintrags in Sekunden; Altdaten kennen nur ganze Minuten. */
export function entrySeconds(e: { durationSeconds?: number | null; durationMinutes?: number | null }): number {
  return e.durationSeconds ?? (e.durationMinutes ?? 0) * 60;
}

export function toDateKeyFromIso(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : toDateKey(parsed);
}

export function diffDays(from: string | null | undefined, to: string | null | undefined): number | null {
  const fromKey = toDateKeyFromIso(from);
  const toKey = toDateKeyFromIso(to);
  if (!fromKey || !toKey) return null;
  const fromDate = new Date(`${fromKey}T00:00:00`);
  const toDate = new Date(`${toKey}T00:00:00`);
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000);
}

export function daysSince(value: string | null | undefined, referenceDate = today()): number | null {
  return diffDays(value, referenceDate);
}

export function isToday(value: string | null | undefined, referenceDate = today()): boolean {
  return toDateKeyFromIso(value) === referenceDate;
}

export function isRecurringDueOn(rule: import('./types').RecurrenceRule, date: string): boolean {
  const d = new Date(date + 'T00:00:00');
  const dow = d.getDay(); // 0=So, 1=Mo ... 6=Sa

  if (rule.weekdays && rule.weekdays.length > 0) {
    if (!rule.weekdays.includes(dow)) return false;
  } else if (rule.frequency) {
    // Legacy format migration
    if (rule.frequency === 'daily') {
      if (dow === 0 || dow === 6) return false; // skip weekends
    } else if (rule.frequency === 'weekly') {
      if (rule.dayOfWeek !== dow) return false;
    } else if (rule.frequency === 'monthly') {
      if (d.getDate() !== rule.dayOfMonth) return false;
    }
  } else {
    return false;
  }

  if (rule.startDate && date < rule.startDate) return false;
  if (rule.endDate && date > rule.endDate) return false;
  return true;
}

export function formatElapsed(startedAt: string): string {
  const elapsed = Math.round((Date.now() - new Date(startedAt).getTime()) / 1000);
  return formatTrackedTime(elapsed);
}

/** `2026-11-12` plus `days` (may be negative) as a date key. */
export function addDaysToKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/** ISO calendar week number (Monday start) of a date key. */
export function isoWeekNumber(dateKey: string): number {
  const d = new Date(`${dateKey}T00:00:00`);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day + 3); // Thursday of that week decides the year
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const firstDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

/** Duration in the design's style: `5 h 15`, `2 h`, `30 min`, `0 min`. */
export function formatHm(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r === 0 ? `${h} h` : `${h} h ${String(r).padStart(2, '0')}`;
}
