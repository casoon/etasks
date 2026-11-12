<!-- @module:time-tracking -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    $timeEntries as timeEntriesStore,
    $activeEntry as activeEntryStore,
    stopActiveTimer,
    addTimeEntry,
    updateTimeEntry,
    deleteTimeEntryById,
  } from '../../stores/timerStore';
  import { $tasks as tasksStore } from '../../stores/taskStore';
  import { $projects as projectsStore } from '../../stores/projectStore';
  import { formatTrackedTime, entrySeconds } from '../../domain/dateUtils';
  import { formatTime, toDateKey, getWeekRange } from '../../domain/dateUtils';
  import type { TimeEntry } from '../../domain/types';

  $: entries = $timeEntriesStore;
  $: tasks = $tasksStore;
  $: projects = $projectsStore;
  $: activeEntry = $activeEntryStore;

  // Ticks once per second while a timer runs; drives the live clock and the running totals.
  let now = Date.now();
  let interval: ReturnType<typeof setInterval> | null = null;
  $: {
    if (interval) { clearInterval(interval); interval = null; }
    if (activeEntry) {
      now = Date.now();
      interval = setInterval(() => { now = Date.now(); }, 1000);
    }
  }
  onDestroy(() => { if (interval) clearInterval(interval); });

  function secondsOf(e: TimeEntry, at: number): number {
    return e.endAt ? entrySeconds(e) : Math.max(0, Math.round((at - new Date(e.startAt).getTime()) / 1000));
  }

  $: sorted = [...entries].sort(
    (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()
  );

  $: byDate = (() => {
    const map: Record<string, typeof sorted> = {};
    for (const entry of sorted) {
      const d = toDateKey(new Date(entry.startAt));
      map[d] = map[d] ?? [];
      map[d].push(entry);
    }
    return map;
  })();

  // Calendar week Monday–Sunday, same as in Analytics
  $: week = getWeekRange(new Date(now));
  $: weekSeconds = sorted
    .filter(e => { const d = toDateKey(new Date(e.startAt)); return d >= week.start && d <= week.end; })
    .reduce((s, e) => s + secondsOf(e, now), 0);

  function getTask(id: string) { return tasks.find(t => t.id === id); }
  function getProject(id?: string) { return id ? projects.find(p => p.id === id) : null; }

  function dateLabel(d: string) {
    const today = toDateKey(new Date());
    const yesterday = toDateKey(new Date(Date.now() - 86400000));
    if (d === today) return 'Heute';
    if (d === yesterday) return 'Gestern';
    return new Date(d + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'short' });
  }

  // --- Edit / add ---
  interface Draft { id: string | null; taskId: string; date: string; start: string; end: string }
  let draft: Draft | null = null;
  let error = '';

  $: selectableTasks = tasks
    .filter(t => t.status !== 'done' || t.id === draft?.taskId)
    .sort((a, b) => a.title.localeCompare(b.title, 'de'));

  function hhmm(iso: string) {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function startAdd() {
    const d = new Date();
    draft = { id: null, taskId: '', date: toDateKey(d), start: '', end: hhmm(d.toISOString()) };
    error = '';
  }

  function startEdit(e: TimeEntry) {
    draft = { id: e.id, taskId: e.taskId, date: toDateKey(new Date(e.startAt)), start: hhmm(e.startAt), end: hhmm(e.endAt!) };
    error = '';
  }

  function saveDraft() {
    if (!draft) return;
    if (!draft.taskId) { error = 'Bitte eine Aufgabe wählen.'; return; }
    if (!draft.date || !draft.start || !draft.end) { error = 'Bitte Datum, Start und Ende angeben.'; return; }
    const startAt = new Date(`${draft.date}T${draft.start}`);
    const endAt = new Date(`${draft.date}T${draft.end}`);
    if (!(endAt.getTime() > startAt.getTime())) { error = 'Das Ende muss nach dem Start liegen.'; return; }
    if (draft.id) updateTimeEntry(draft.id, draft.taskId, startAt.toISOString(), endAt.toISOString());
    else addTimeEntry(draft.taskId, startAt.toISOString(), endAt.toISOString());
    draft = null;
  }

  function removeEntry(e: TimeEntry) {
    const title = getTask(e.taskId)?.title ?? 'Gelöschte Aufgabe';
    if (!confirm(`Zeiteintrag „${title}“ (${formatTrackedTime(entrySeconds(e))}) löschen?`)) return;
    deleteTimeEntryById(e.id);
  }

  const inputCls = 'border border-border rounded-md px-2 py-1 text-[13px] bg-bg text-primary';
</script>

<div class="flex-1 flex flex-col overflow-hidden">
  {#if activeEntry}
    {@const activeTask = getTask(activeEntry.taskId)}
    <div class="flex items-center gap-3 px-6 py-2 bg-accent-subtle border-b border-border text-[13px] text-accent flex-shrink-0">
      <span class="w-2 h-2 rounded-full bg-accent flex-shrink-0 animate-pulse" />
      <span class="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">Läuft: {activeTask?.title ?? 'Gelöschte Aufgabe'}</span>
      <span class="font-semibold tabular-nums flex-shrink-0">{formatTrackedTime(secondsOf(activeEntry, now))}</span>
      <button
        class="px-3 py-1 text-secondary rounded-lg text-[13px] hover:bg-gray-100 transition-colors flex-shrink-0"
        on:click={() => stopActiveTimer()}
      >⏹ Stoppen</button>
    </div>
  {/if}

  <div class="flex gap-3 flex-wrap items-center px-6 py-4 border-b border-border flex-shrink-0">
    <div class="bg-surface border border-border rounded-xl px-4 py-3 flex flex-col gap-1 min-w-[120px]">
      <span class="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">Diese Woche</span>
      <span class="text-[22px] font-bold text-primary tabular-nums">{formatTrackedTime(weekSeconds)}</span>
    </div>
    <div class="bg-surface border border-border rounded-xl px-4 py-3 flex flex-col gap-1 min-w-[120px]">
      <span class="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">Einträge gesamt</span>
      <span class="text-[22px] font-bold text-primary tabular-nums">{entries.length}</span>
    </div>
    <button
      class="ml-auto px-3 py-1.5 rounded-lg border border-border text-[13px] text-secondary hover:bg-bg hover:text-primary transition-colors"
      on:click={startAdd}
    >+ Eintrag hinzufügen</button>
  </div>

  <div class="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-6">
    {#if draft}
      <form class="flex flex-col gap-3 px-4 py-3 rounded-lg border border-border bg-surface" on:submit|preventDefault={saveDraft}>
        <span class="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">{draft.id ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}</span>
        <div class="flex items-center gap-2 flex-wrap">
          <select class="{inputCls} max-w-[240px]" bind:value={draft.taskId} aria-label="Aufgabe">
            <option value="">Aufgabe wählen</option>
            {#each selectableTasks as t (t.id)}<option value={t.id}>{t.title}</option>{/each}
          </select>
          <input type="date" class={inputCls} bind:value={draft.date} aria-label="Datum" />
          <input type="time" class={inputCls} bind:value={draft.start} aria-label="Start" />
          <span class="text-muted text-[13px]">–</span>
          <input type="time" class={inputCls} bind:value={draft.end} aria-label="Ende" />
        </div>
        {#if error}<p class="text-[12px] text-red-500">{error}</p>{/if}
        <div class="flex items-center gap-2">
          <button type="submit" class="px-3 py-1.5 rounded-lg bg-accent text-white text-[13px] font-medium hover:bg-blue-600 transition-colors">Speichern</button>
          <button type="button" class="px-3 py-1.5 rounded-lg text-[13px] text-secondary hover:bg-bg transition-colors" on:click={() => (draft = null)}>Abbrechen</button>
        </div>
      </form>
    {/if}

    {#if entries.length === 0 && !draft}
      <div class="flex flex-col items-center gap-4 py-10 px-6 text-center">
        <p class="text-[13px] text-muted leading-relaxed max-w-xs">Noch keine Zeiteinträge. Starte den Timer über den ▶-Button an einer Aufgabe in „Heute“ oder in der Tagesplanung, oder füge einen Eintrag von Hand hinzu.</p>
        <button
          class="px-4 py-2 rounded-lg border border-border text-[13px] text-secondary hover:bg-bg hover:text-primary transition-colors"
          on:click={() => window.dispatchEvent(new CustomEvent('etasks:nav', { detail: 'planning-daily' }))}
        >Zur Tagesplanung →</button>
      </div>
    {/if}

    {#each Object.entries(byDate) as [date, dateEntries] (date)}
      {@const dayTotal = dateEntries.reduce((s, e) => s + secondsOf(e, now), 0)}
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between pb-2 border-b border-border-subtle">
          <span class="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">{dateLabel(date)}</span>
          <span class="text-[12px] font-semibold text-secondary tabular-nums">{formatTrackedTime(dayTotal)}</span>
        </div>
        {#each dateEntries as entry (entry.id)}
          {@const task = getTask(entry.taskId)}
          {@const project = getProject(entry.projectId ?? task?.projectId)}
            <div class="group flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-bg">
              {#if project}<span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{project.color}" />{/if}
              <span class="flex-1 text-[13px] text-primary overflow-hidden text-ellipsis whitespace-nowrap min-w-0">{task?.title ?? 'Gelöschte Aufgabe'}</span>
              {#if project}<span class="text-[11px] text-muted whitespace-nowrap">{project.name}</span>{/if}
              <span class="text-[11px] text-muted whitespace-nowrap">{formatTime(entry.startAt)} – {entry.endAt ? formatTime(entry.endAt) : '…'}</span>
              {#if !entry.endAt}<span class="text-[11px] font-semibold text-accent whitespace-nowrap">läuft</span>{/if}
              <span class="text-[12px] font-semibold text-secondary tabular-nums whitespace-nowrap">{formatTrackedTime(secondsOf(entry, now))}</span>
              {#if entry.endAt}
                <button class="text-[12px] text-muted opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-primary transition-opacity" title="Bearbeiten" aria-label="Eintrag bearbeiten" on:click={() => startEdit(entry)}>✎</button>
                <button class="text-[12px] text-muted opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-500 transition-opacity" title="Löschen" aria-label="Eintrag löschen" on:click={() => removeEntry(entry)}>✕</button>
              {/if}
            </div>
        {/each}
      </div>
    {/each}
  </div>
</div>
