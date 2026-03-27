import type { CalendarBlock } from '../domain/types';
import { toDateKey } from '../domain/dateUtils';
import { isNeutralinoAvailable } from './platform';

declare const Neutralino: any;

function parseICalDate(raw: string): Date | null {
  // Formate: 20260327T090000Z, 20260327T090000, 20260327
  const clean = raw.split(';').pop()?.trim() ?? raw.trim();
  const m = clean.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/);
  if (!m) return null;
  const [, y, mo, d, h = '0', min = '0', s = '0'] = m;
  return new Date(`${y}-${mo}-${d}T${h.padStart(2,'0')}:${min.padStart(2,'0')}:${s.padStart(2,'0')}Z`);
}

export function parseICS(rawText: string): CalendarBlock[] {
  const blocks: CalendarBlock[] = [];
  const lines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  // Unfold (lines starting with space/tab continue prev line)
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
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      inEvent = false;
      const start = parseICalDate(current['DTSTART'] ?? '');
      const end = parseICalDate(current['DTEND'] ?? current['DTSTART'] ?? '');
      const summary = current['SUMMARY'] ?? 'Termin';
      const uid = current['UID'] ?? crypto.randomUUID();

      if (start && end) {
        blocks.push({
          id: uid,
          start: start.toISOString(),
          end: end.toISOString(),
          title: summary,
          date: toDateKey(start),
        });
      }
      continue;
    }
    if (!inEvent) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).split(';')[0].toUpperCase();
    const value = line.slice(colonIdx + 1);
    current[key] = value;
  }

  return blocks;
}

export async function importICSFile(): Promise<CalendarBlock[]> {
  if (isNeutralinoAvailable()) {
    try {
      const result = await Neutralino.os.showOpenDialog('ICS-Datei öffnen', {
        filters: [{ name: 'iCalendar', extensions: ['ics'] }],
      });
      if (!result || result.length === 0) return [];
      const content = await Neutralino.filesystem.readFile(result[0]);
      return parseICS(content);
    } catch (e) {
      console.warn('Neutralino ICS import failed:', e);
    }
  }

  // Browser-Fallback
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
