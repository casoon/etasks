import { describe, expect, it, vi } from 'vitest';

vi.mock('@casoon/origin-client', () => ({ command: vi.fn() }));
vi.mock('../stores/configStore', () => ({ $appConfig: { get: () => null } }));

import {
  buildViewRows,
  detectPreset,
  formatDuration,
  periodLabel,
  presetRange,
  reportText,
  reportTotals,
} from './reportView';

const projects = [
  { id: 'p1', name: 'Relaunch', clientId: 'c1', color: '#111111' },
  { id: 'p2', name: 'Shop', clientId: 'c2', color: '#222222' },
] as never[];
const clients = [{ id: 'c1', name: 'Hansen' }, { id: 'c2', name: 'Praxis' }] as never[];
const tasks = [
  { id: 't1', title: 'Layout', status: 'done', projectId: 'p1', completedAt: '2026-11-10T10:00:00', updatedAt: '', estimatedMinutes: 60 },
  { id: 't2', title: 'Warenkorb', status: 'done', projectId: 'p2', completedAt: '2026-11-11T10:00:00', updatedAt: '' },
] as never[];
const entries = [
  { id: 'e1', taskId: 't1', projectId: 'p1', startAt: '2026-11-10T08:00:00', endAt: '2026-11-10T09:30:00', durationSeconds: 5400 },
] as never[];
const termine = [
  { id: 'x1', title: 'Videocall', date: '2026-11-12', durationMinutes: 30, billable: true, projectId: 'p1' },
] as never[];
const data = { tasks, timeEntries: entries, termine, projects, clients };
const range = { from: '2026-11-01', to: '2026-11-12' };

describe('buildViewRows', () => {
  it('merges tasks, time and billable Termine, sorted by day', () => {
    const rows = buildViewRows(data, { ...range, clientId: '', projectId: '' });
    expect(rows.map((r) => r.title)).toEqual(['Layout', 'Warenkorb', 'Termin: Videocall']);
    expect(rows[0]).toMatchObject({ clientName: 'Hansen', trackedMinutes: 90, estimatedMinutes: 60 });
  });
  it('filters by client and project', () => {
    expect(buildViewRows(data, { ...range, clientId: 'c2', projectId: '' }).map((r) => r.title)).toEqual(['Warenkorb']);
    expect(buildViewRows(data, { ...range, clientId: '', projectId: 'p1' })).toHaveLength(2);
  });
  it('totals include Termine separately', () => {
    const t = reportTotals(buildViewRows(data, { ...range, clientId: 'c1', projectId: '' }));
    expect(t).toMatchObject({ count: 2, trackedMinutes: 120, terminCount: 1, terminMinutes: 30 });
  });
});

describe('periods', () => {
  const now = new Date('2026-11-12T10:00:00'); // Thursday
  it('presets', () => {
    expect(presetRange('week', now)).toEqual({ from: '2026-11-09', to: '2026-11-12' });
    expect(presetRange('last-week', now)).toEqual({ from: '2026-11-02', to: '2026-11-08' });
    expect(presetRange('month', now)).toEqual({ from: '2026-11-01', to: '2026-11-12' });
  });
  it('detects a preset or custom', () => {
    expect(detectPreset('2026-11-01', '2026-11-12', now)).toBe('month');
    expect(detectPreset('2026-11-03', '2026-11-12', now)).toBe('custom');
  });
  it('labels the performance period', () => {
    expect(periodLabel('2026-11-01', '2026-11-12')).toBe('01.–12.11.2026');
    expect(periodLabel('2026-10-28', '2026-11-12')).toBe('28.10.2026–12.11.2026');
    expect(periodLabel('2026-11-12', '2026-11-12')).toBe('12.11.2026');
  });
});

describe('text', () => {
  it('formats durations', () => {
    expect(formatDuration(0)).toBe('—');
    expect(formatDuration(90)).toBe('1 h 30 min');
    expect(formatDuration(120)).toBe('2 h');
  });
  it('groups by project with totals', () => {
    const rows = buildViewRows(data, { ...range, clientId: 'c1', projectId: '' });
    const text = reportText(rows, 'Hansen', range.from, range.to);
    expect(text).toContain('Tätigkeitsbericht für Hansen');
    expect(text).toContain('Zeitraum: 01.11.2026 – 12.11.2026');
    expect(text).toContain('  • 10.11.2026  Layout (1 h 30 min)');
    expect(text).toContain('Gesamtaufwand: 2 h');
  });
});
