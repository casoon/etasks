import type { CalendarBlock } from '../domain/types';
import { toDateKey } from '../domain/dateUtils';
import { isTauriAvailable } from './platform';
import { invoke } from '@tauri-apps/api/core';

function parseICalDate(raw: string): Date | null {
  const clean = raw.split(';').pop()?.trim() ?? raw.trim();
  const m = clean.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/);
  if (!m) return null;
  const [, y, mo, d, h = '0', min = '0', s = '0'] = m;
  return new Date(`${y}-${mo}-${d}T${h.padStart(2,'0')}:${min.padStart(2,'0')}:${s.padStart(2,'0')}Z`);
}

export function parseICS(rawText: string): CalendarBlock[] {
  const blocks: CalendarBlock[] = [];
  const lines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  const unfolded: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }

  let inEvent = false;
  let current: Record<string, string> = {};

  for (const line of unfolded) {
    if (line === 'BEGIN:VEVENT') { inEvent = true; current = {}; continue; }
    if (line === 'END:VEVENT') {
      inEvent = false;
      const start = parseICalDate(current['DTSTART'] ?? '');
      const end = parseICalDate(current['DTEND'] ?? current['DTSTART'] ?? '');
      const summary = current['SUMMARY'] ?? 'Termin';
      const uid = current['UID'] ?? crypto.randomUUID();
      if (start && end) {
        blocks.push({ id: uid, start: start.toISOString(), end: end.toISOString(), title: summary, date: toDateKey(start) });
      }
      continue;
    }
    if (!inEvent) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    current[line.slice(0, colonIdx).split(';')[0].toUpperCase()] = line.slice(colonIdx + 1);
  }

  return blocks;
}

export async function importICSFile(): Promise<CalendarBlock[]> {
  if (isTauriAvailable()) {
    try {
      const content = await invoke<string | null>('open_ics_file');
      if (content) return parseICS(content);
      return [];
    } catch (e) {
      console.warn('Tauri ICS import failed:', e);
    }
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ics,text/calendar';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { resolve([]); return; }
      const reader = new FileReader();
      reader.onload = (e) => resolve(parseICS(e.target?.result as string ?? ''));
      reader.onerror = () => resolve([]);
      reader.readAsText(file);
    };
    input.click();
  });
}
