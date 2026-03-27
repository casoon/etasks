import { describe, it, expect } from 'vitest';
import { parseICS } from './icsParser';

const BASIC_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:abc123@test
DTSTART:20260327T090000Z
DTEND:20260327T100000Z
SUMMARY:Team Meeting
END:VEVENT
END:VCALENDAR`;

const MULTI_EVENT_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:evt-1@test
DTSTART:20260327T090000Z
DTEND:20260327T093000Z
SUMMARY:Standup
END:VEVENT
BEGIN:VEVENT
UID:evt-2@test
DTSTART:20260327T110000Z
DTEND:20260327T120000Z
SUMMARY:Retro
END:VEVENT
END:VCALENDAR`;

const DATE_ONLY_ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:all-day@test
DTSTART:20260327
DTEND:20260328
SUMMARY:Urlaub
END:VEVENT
END:VCALENDAR`;

const FOLDED_ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:folded@test
DTSTART:20260327T140000Z
DTEND:20260327T150000Z
SUMMARY:Sehr langer Titel der in mehrere Zeilen um
 gebrochen wurde und RFC5545 Folding verwendet
END:VEVENT
END:VCALENDAR`;

const CRLF_ICS = BASIC_ICS.replace(/\n/g, '\r\n');

describe('parseICS', () => {
  it('parses a basic single event', () => {
    const blocks = parseICS(BASIC_ICS);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].title).toBe('Team Meeting');
  });

  it('uses UID as block id', () => {
    const [block] = parseICS(BASIC_ICS);
    expect(block.id).toBe('abc123@test');
  });

  it('parses start and end ISO strings correctly', () => {
    const [block] = parseICS(BASIC_ICS);
    expect(block.start).toBe('2026-03-27T09:00:00.000Z');
    expect(block.end).toBe('2026-03-27T10:00:00.000Z');
  });

  it('sets date field to the start date', () => {
    const [block] = parseICS(BASIC_ICS);
    expect(block.date).toBe('2026-03-27');
  });

  it('parses multiple events', () => {
    const blocks = parseICS(MULTI_EVENT_ICS);
    expect(blocks).toHaveLength(2);
    expect(blocks.map(b => b.title)).toEqual(['Standup', 'Retro']);
  });

  it('parses date-only DTSTART (all-day events)', () => {
    const blocks = parseICS(DATE_ONLY_ICS);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].title).toBe('Urlaub');
    expect(blocks[0].date).toBe('2026-03-27');
  });

  it('handles RFC5545 line folding', () => {
    const blocks = parseICS(FOLDED_ICS);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].title).toContain('Folding');
  });

  it('handles CRLF line endings', () => {
    const blocks = parseICS(CRLF_ICS);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].title).toBe('Team Meeting');
  });

  it('returns empty array for empty input', () => {
    expect(parseICS('')).toEqual([]);
  });

  it('returns empty array when there are no VEVENT blocks', () => {
    expect(parseICS('BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR')).toEqual([]);
  });

  it('uses fallback title "Termin" when SUMMARY is missing', () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:no-summary@test
DTSTART:20260327T090000Z
DTEND:20260327T100000Z
END:VEVENT
END:VCALENDAR`;
    const [block] = parseICS(ics);
    expect(block.title).toBe('Termin');
  });

  it('skips events with invalid DTSTART', () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:bad-date@test
DTSTART:INVALID
DTEND:ALSO_INVALID
SUMMARY:Broken
END:VEVENT
END:VCALENDAR`;
    expect(parseICS(ics)).toHaveLength(0);
  });

  it('handles DTSTART with timezone parameter', () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:tz@test
DTSTART;TZID=Europe/Berlin:20260327T100000
DTEND;TZID=Europe/Berlin:20260327T110000
SUMMARY:Termin mit TZ
END:VEVENT
END:VCALENDAR`;
    const blocks = parseICS(ics);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].title).toBe('Termin mit TZ');
  });
});
