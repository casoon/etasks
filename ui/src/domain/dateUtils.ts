// @core
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
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

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
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
