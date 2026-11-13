<!-- @module:time-tracking -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    $timeEntries as timeEntriesStore,
    $activeEntry as activeEntryStore,
    stopActiveTimer,
    deleteTimeEntryById,
  } from '../../stores/timerStore';
  import { $tasks as tasksStore } from '../../stores/taskStore';
  import { $projects as projectsStore, $clients as clientsStore } from '../../stores/projectStore';
  import { openToday } from '../../stores/uiStore';
  import { toast } from '../../stores/toastStore';
  import {
    addDaysToKey,
    entrySeconds,
    formatDate,
    formatHm,
    formatTime,
    getWeekStart,
    isoWeekNumber,
    today,
  } from '../../domain/dateUtils';
  import type { TimeEntry } from '../../domain/types';
  import { entryTrackedSeconds, formatClock, trackedSecondsOn } from '../../lib/dayStats';
  import { saveCsvFile } from '../../lib/csvExport';
  import { customerMinutes, formatWeekRange } from '../../lib/weekStats';
  import {
    entryProjectId,
    filterEntries,
    groupByDay,
    timeEntriesCsv,
    type ProjectFilter,
  } from '../../lib/timeWeek';
  import TimeEntryForm from './TimeEntryForm.svelte';

  $: entries = $timeEntriesStore;
  $: tasks = $tasksStore;
  $: projects = $projectsStore;
  $: activeEntry = $activeEntryStore;

  let weekStart = getWeekStart(new Date());
  let projectFilter: ProjectFilter = 'all';
  /** `'new'` shows the empty form, an entry id edits that row. */
  let editing: 'new' | string | null = null;

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

  const secondsOf = (e: TimeEntry, at: number) => entryTrackedSeconds(e, at);

  $: weekEnd = addDaysToKey(weekStart, 6);
  $: isCurrentWeek = weekStart === getWeekStart(new Date(now));
  $: weekEntries = filterEntries(entries, tasks, weekStart, weekEnd, 'all');
  $: visible = filterEntries(entries, tasks, weekStart, weekEnd, projectFilter);
  $: groups = groupByDay(visible);

  $: todaySeconds = trackedSecondsOn(entries, today(), now);
  $: weekSeconds = weekEntries.reduce((s, e) => s + secondsOf(e, now), 0);
  $: split = customerMinutes(entries, projects, weekStart, weekEnd, now);

  // Chips: only projects that have entries in the shown week, plus „Ohne Projekt“.
  $: chipProjects = projects.filter((p) => weekEntries.some((e) => entryProjectId(e, tasks) === p.id));
  $: hasNoProject = weekEntries.some((e) => !entryProjectId(e, tasks));
  $: if (projectFilter !== 'all' && !(projectFilter === 'none' ? hasNoProject : chipProjects.some((p) => p.id === projectFilter))) projectFilter = 'all';

  $: activeTask = activeEntry ? tasks.find((t) => t.id === activeEntry.taskId) : undefined;
  $: activeProject = activeEntry ? projects.find((p) => p.id === entryProjectId(activeEntry, tasks)) : undefined;

  const getTask = (id: string) => tasks.find((t) => t.id === id);
  const getProject = (e: TimeEntry) => projects.find((p) => p.id === entryProjectId(e, tasks));

  function dayHeading(date: string): string {
    return date === today() ? `Heute · ${formatDate(date)}` : formatDate(date);
  }

  function removeEntry(e: TimeEntry) {
    const title = getTask(e.taskId)?.title ?? 'Gelöschte Aufgabe';
    if (!confirm(`Zeiteintrag „${title}“ (${formatHm(entrySeconds(e) / 60)}) löschen?`)) return;
    deleteTimeEntryById(e.id);
  }

  let exporting = false;
  async function exportCsv() {
    if (exporting || visible.length === 0) return;
    exporting = true;
    try {
      const csv = timeEntriesCsv(visible, tasks, projects, $clientsStore, Date.now());
      const path = await saveCsvFile(`etasks-zeiten-${weekStart}.csv`, csv);
      toast(path ? `CSV gespeichert: ${path}` : 'CSV exportiert.', 'success', 4000);
    } catch (error) {
      toast(`CSV-Export fehlgeschlagen: ${String(error)}`, 'error', 6000);
    } finally {
      exporting = false;
    }
  }
</script>

<div class="flex-1 overflow-y-auto">
  <div class="flex flex-col gap-[18px] px-8 pt-5 pb-7">
    <header class="flex flex-wrap items-center gap-3">
      <div class="flex-1 min-w-[260px] flex flex-col gap-0.5">
        <h1 class="text-[24px] font-bold tracking-[-0.01em] leading-tight">Zeiten</h1>
        <span class="text-[13px]" style="color:var(--et-text-3)">KW {isoWeekNumber(weekStart)} · {formatWeekRange(weekStart)}</span>
      </div>
      <div class="flex items-center gap-1">
        <button class="et-btn et-btn-icon" style="border-color:var(--et-border)" aria-label="Vorherige Woche" on:click={() => (weekStart = addDaysToKey(weekStart, -7))}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"></path></svg>
        </button>
        <button class="et-btn" style="border-color:var(--et-border)" disabled={isCurrentWeek} on:click={() => (weekStart = getWeekStart(new Date()))}>Diese Woche</button>
        <button class="et-btn et-btn-icon" style="border-color:var(--et-border)" aria-label="Nächste Woche" on:click={() => (weekStart = addDaysToKey(weekStart, 7))}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>
        </button>
      </div>
      <button class="et-btn et-btn-primary" on:click={() => (editing = 'new')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>
        Eintrag nachtragen
      </button>
    </header>

    {#if activeEntry}
      <div class="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3.5 rounded-xl" style="background:var(--et-inverse);color:#fff">
        <span class="w-2.5 h-2.5 rounded-full animate-pulse" style="background:#6FD39B" aria-hidden="true"></span>
        <span class="flex-[1_1_260px] flex flex-col min-w-0">
          <span class="font-semibold truncate">{activeTask?.title ?? 'Gelöschte Aufgabe'}</span>
          <span class="text-[12px]" style="color:#D6D3CC">{activeProject?.name ?? 'Ohne Projekt'} · gestartet {formatTime(activeEntry.startAt)}</span>
        </span>
        <span class="text-[22px] font-semibold tabular-nums" role="timer" aria-label="Laufzeit">{formatClock(secondsOf(activeEntry, now))}</span>
        <button class="et-btn" style="border-color:#fff" on:click={() => stopActiveTimer()}>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="2" fill="currentColor"></rect></svg>
          Stoppen
        </button>
      </div>
    {/if}

    <div class="grid gap-4" style="grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr))">
      <div class="et-tile">
        <span class="et-tile-label">Heute</span>
        <span class="et-tile-value">{formatHm(todaySeconds / 60)}</span>
        <span class="et-tile-note">{activeEntry ? 'inklusive laufendem Timer' : 'erfasst'}</span>
      </div>
      <div class="et-tile">
        <span class="et-tile-label">{isCurrentWeek ? 'Diese Woche' : `KW ${isoWeekNumber(weekStart)}`}</span>
        <span class="et-tile-value">{formatHm(weekSeconds / 60)}</span>
        <span class="et-tile-note">davon {formatHm(split.customer)} für Kunden</span>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <button class="et-chip" aria-pressed={projectFilter === 'all'} on:click={() => (projectFilter = 'all')}>Alle Projekte</button>
      {#each chipProjects as project (project.id)}
        <button class="et-chip" aria-pressed={projectFilter === project.id} on:click={() => (projectFilter = project.id)}>{project.name}</button>
      {/each}
      {#if hasNoProject}
        <button class="et-chip" aria-pressed={projectFilter === 'none'} on:click={() => (projectFilter = 'none')}>Ohne Projekt</button>
      {/if}
      <span class="flex-1"></span>
      <button class="et-chip" style="border-radius:8px" disabled={visible.length === 0 || exporting} on:click={exportCsv}>Als CSV exportieren</button>
    </div>

    <div class="overflow-x-auto et-card">
      <div class="min-w-[820px] flex flex-col">
        {#if editing === 'new'}
          <TimeEntryForm entry={null} defaultDate={isCurrentWeek ? today() : weekStart} onDone={() => (editing = null)} />
        {/if}

        {#if groups.length === 0 && editing !== 'new'}
          <div class="flex flex-col items-center gap-4 py-10 px-6 text-center">
            <p class="text-[13px] max-w-md" style="color:var(--et-text-3)">
              {entries.length === 0
                ? 'Noch keine Zeiteinträge. Starte den Timer an einer Aufgabe in „Heute“ oder trage einen Eintrag von Hand nach.'
                : weekEntries.length === 0
                  ? 'In dieser Woche wurde keine Zeit erfasst.'
                  : 'Für diesen Filter gibt es keine Einträge.'}
            </p>
            {#if entries.length === 0}
              <button class="et-btn" on:click={() => openToday('plan')}>Zur Tagesplanung</button>
            {/if}
          </div>
        {/if}

        {#each groups as group, gi (group.date)}
          {@const dayTotal = group.entries.reduce((s, e) => s + secondsOf(e, now), 0)}
          <div class="flex items-center gap-3 px-5 py-3 {gi > 0 || editing === 'new' ? 'border-t' : 'rounded-t-[14px]'}" style="background:var(--et-surface-sunken);border-color:var(--et-border)">
            <h2 class="flex-1 text-[14px] font-semibold">{dayHeading(group.date)}</h2>
            <span class="font-semibold tabular-nums">{formatHm(dayTotal / 60)}</span>
          </div>
          {#each group.entries as entry (entry.id)}
            {@const task = getTask(entry.taskId)}
            {@const project = getProject(entry)}
            {@const running = !entry.endAt}
            {#if editing === entry.id}
              <TimeEntryForm {entry} defaultDate={group.date} onDone={() => (editing = null)} />
            {:else}
              <div
                class="et-row grid items-center gap-4 min-h-[52px] pl-5 pr-3"
                style="grid-template-columns:2.4fr 1.4fr 1.2fr 0.7fr 96px;{running ? 'background:var(--et-accent-soft)' : ''}"
              >
                <span class="flex items-center gap-2.5 min-w-0">
                  <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{project?.color ?? 'var(--et-project-neutral)'}" aria-hidden="true"></span>
                  <span class="truncate {running ? 'font-semibold' : 'font-medium'}">{task?.title ?? 'Gelöschte Aufgabe'}</span>
                </span>
                <span class="text-[13px] truncate" style="color:{running ? 'var(--et-text-2)' : 'var(--et-text-3)'}">{project?.name ?? 'Ohne Projekt'}</span>
                <span class="text-[13px] tabular-nums">{formatTime(entry.startAt)} – {entry.endAt ? formatTime(entry.endAt) : 'jetzt'}</span>
                <span class="font-semibold tabular-nums">{formatHm(secondsOf(entry, now) / 60)}</span>
                {#if running}
                  <span class="text-[12px] font-semibold" style="color:var(--et-accent-strong)">läuft</span>
                {:else}
                  <span class="flex gap-1">
                    <button class="et-btn et-btn-ghost et-btn-icon" style="width:40px;height:40px" aria-label="Eintrag bearbeiten" on:click={() => (editing = entry.id)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"></path></svg>
                    </button>
                    <button class="et-btn et-btn-ghost et-btn-icon" style="width:40px;height:40px" aria-label="Eintrag löschen" on:click={() => removeEntry(entry)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"></path></svg>
                    </button>
                  </span>
                {/if}
              </div>
            {/if}
          {/each}
        {/each}
      </div>
    </div>
  </div>
</div>
