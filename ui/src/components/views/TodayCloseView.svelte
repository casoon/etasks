<!-- @core -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { openToday, $navItem as navItemStore } from '../../stores/uiStore';
  import {
    $activeDate as activeDateStore,
    $todayTasks as todayTasksStore,
    toggleTask,
  } from '../../stores/taskStore';
  import { $projects as projectsStore } from '../../stores/projectStore';
  import { $termine as termineStore } from '../../stores/terminStore';
  import { $bridgeTimeEntries as timeEntriesStore } from '../../stores/coreBridge';
  import { $activeEntry as activeEntryStore } from '../../stores/timerStore';
  import { addDaysToKey, formatHm } from '../../domain/dateUtils';
  import { trackedSecondsByProject, trackedSecondsOn } from '../../lib/dayStats';
  import { moveTaskToPool, postponeTask } from '../../lib/taskActions';
  import { upsertNote, loadNotes } from '../../lib/db';
  import type { Task } from '../../domain/types';

  $: activeDate = $activeDateStore;
  $: tasks = $todayTasksStore;
  $: openTasks = tasks.filter(t => t.status === 'todo');
  $: doneTasks = tasks.filter(t => t.status === 'done');
  $: projectMap = new Map($projectsStore.map(p => [p.id, p]));

  let highlight = '';
  // Pre-fill with the highlight already saved for the day (again when the day changes)
  let loadedFor = '';
  $: if (activeDate !== loadedFor) {
    loadedFor = activeDate;
    highlight = loadNotes().find(n => n.date === activeDate)?.highlight ?? '';
  }

  let nowMs = Date.now();
  onMount(() => {
    const id = setInterval(() => { nowMs = Date.now(); }, 30_000);
    return () => clearInterval(id);
  });

  $: trackedSeconds = trackedSecondsOn($timeEntriesStore, activeDate, nowMs);
  $: byProject = [...trackedSecondsByProject($timeEntriesStore, activeDate, nowMs).entries()]
    .map(([id, seconds]) => ({ id, seconds, project: projectMap.get(id) }))
    .filter(p => p.project)
    .sort((a, b) => b.seconds - a.seconds);
  $: plannedMinutes = tasks.reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0);
  $: terminMinutes = $termineStore.filter(t => t.date === activeDate).reduce((s, t) => s + t.durationMinutes, 0);

  $: rate = tasks.length === 0 ? 0 : Math.round((doneTasks.length / tasks.length) * 100);
  $: mitTasks = tasks.filter(t => t.priorityRank != null);
  $: allMitDone = mitTasks.length > 0 && mitTasks.every(t => t.status === 'done');
  $: label =
    tasks.length === 0 ? 'Kein Plan für diesen Tag'
    : rate === 100 ? 'Alle Aufgaben erledigt'
    : rate >= 75 ? 'Guter Tag'
    : rate >= 50 ? 'Solider Fortschritt'
    : rate >= 25 ? 'Ein paar Aufgaben erledigt'
    : 'Tag mit Potenzial nach oben';
  $: sentence = `${doneTasks.length} von ${tasks.length} Aufgaben erledigt${allMitDone ? ', alle Top 3 geschafft' : ''}.`;

  function taskMeta(task: Task): string {
    const project = task.projectId ? projectMap.get(task.projectId)?.name : null;
    const tracked = Math.round((task.trackedSeconds ?? 0) / 60);
    const parts = [project ?? 'Ohne Projekt'];
    if (task.estimatedMinutes) {
      parts.push(tracked > 0 ? `${tracked} von ${task.estimatedMinutes} min erfasst` : `${task.estimatedMinutes} min`);
    } else if (tracked > 0) {
      parts.push(`${tracked} min erfasst`);
    }
    return parts.join(' · ');
  }

  function postpone(id: string) {
    postponeTask(id, addDaysToKey(activeDate, 1));
  }
  function postponeAll() {
    for (const t of openTasks) postpone(t.id);
  }
  function markDone(id: string) {
    toggleTask(id);
  }

  function saveHighlight() {
    if (highlight.trim()) {
      upsertNote({ date: activeDate, highlight: highlight.trim(), createdAt: new Date().toISOString() });
    }
  }
  function backToWork() {
    saveHighlight();
    openToday('work');
  }
  function closeDay() {
    saveHighlight();
    openToday('work');
    navItemStore.set('overview');
  }
</script>

<div class="flex-1 overflow-y-auto px-8 pb-7">
  <div class="flex flex-wrap gap-4 items-start">

    <!-- Tagesbilanz -->
    <section aria-label="Tagesbilanz" class="flex-1 basis-[320px] max-w-[420px] min-w-0 flex flex-col gap-5 p-5 rounded-[14px] border border-border bg-surface">
      <h2 class="text-[15px] font-semibold">Dein Tag</h2>
      <div class="flex items-center gap-4">
        <svg width="96" height="96" viewBox="0 0 36 36" role="img" aria-label="{doneTasks.length} von {tasks.length} Aufgaben erledigt" class="flex-shrink-0">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--et-track)" stroke-width="3.2"></circle>
          <circle
            cx="18" cy="18" r="15.9" fill="none" stroke="var(--et-success)" stroke-width="3.2"
            stroke-dasharray="{rate} {100 - rate}" stroke-linecap="round" transform="rotate(-90 18 18)"
          ></circle>
          <text x="18" y="21" text-anchor="middle" font-size="9" font-weight="700" fill="var(--et-text)">{doneTasks.length}/{tasks.length}</text>
        </svg>
        <div class="flex flex-col gap-1 min-w-0">
          <span class="text-[18px] font-bold">{label}</span>
          <span class="text-[13px]" style="color:var(--et-text-3)">{sentence}</span>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-2">
        {#each [
          { l: 'Erfasst', v: formatHm(Math.round(trackedSeconds / 60)) },
          { l: 'Geplant', v: formatHm(plannedMinutes) },
          { l: 'Termine', v: formatHm(terminMinutes) },
        ] as stat}
          <span class="flex flex-col gap-0.5 p-3 rounded-xl" style="background:var(--et-surface-sunken)">
            <span class="text-[12px] font-semibold uppercase tracking-[0.05em]" style="color:var(--et-text-3)">{stat.l}</span>
            <span class="text-[18px] font-bold tabular-nums">{stat.v}</span>
          </span>
        {/each}
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-[12px] font-semibold uppercase tracking-[0.05em]" style="color:var(--et-text-3)">Zeit nach Projekt</span>
        {#each byProject as p (p.id)}
          <div class="flex items-center gap-2 min-h-[28px] text-[14px]">
            <span class="w-2.5 h-2.5 rounded-[3px] flex-shrink-0" style="background:{p.project?.color}" aria-hidden="true"></span>
            <span class="flex-1 min-w-0 truncate">{p.project?.name}</span>
            <span class="tabular-nums" style="color:var(--et-text-3)">{formatHm(Math.round(p.seconds / 60))}</span>
          </div>
        {:else}
          <p class="text-[13px]" style="color:var(--et-text-3)">Heute noch keine Zeit auf Projekten erfasst.</p>
        {/each}
      </div>

      {#if $activeEntryStore}
        <p class="text-[13px] px-3 py-2 rounded-lg" style="background:var(--et-warning-soft);color:var(--et-warning-text)">Ein Timer läuft noch und zählt mit seiner bisherigen Zeit.</p>
      {/if}

      <button
        class="self-start inline-flex items-center gap-1 min-h-[44px] text-[14px] font-medium"
        style="color:var(--et-accent)"
        on:click={() => navItemStore.set('time')}
      >
        Zeiteinträge prüfen
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>
      </button>
    </section>

    <!-- Abschluss -->
    <section aria-label="Abschluss" class="flex-[999] basis-[360px] min-w-0 flex flex-col gap-4">
      <div class="rounded-[14px] border border-border bg-surface">
        <div class="flex items-center gap-3 px-4 pt-3.5 pb-2.5">
          <h2 class="flex-1 text-[15px] font-semibold">Noch offen</h2>
          {#if openTasks.length > 1}
            <button
              class="h-10 px-3.5 rounded-[10px] border border-[var(--et-border-strong)] bg-surface text-[14px] font-medium transition-colors hover:bg-[var(--et-surface-sunken)]"
              style="color:var(--et-text-2)"
              on:click={postponeAll}
            >Alle auf morgen</button>
          {/if}
        </div>
        {#each openTasks as task (task.id)}
          <div class="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 border-t border-[var(--et-border-subtle)]">
            <span class="flex-1 basis-[200px] min-w-0 flex flex-col">
              <span class="font-semibold truncate">{task.title}</span>
              <span class="text-[12px] truncate" style="color:var(--et-text-3)">{taskMeta(task)}</span>
            </span>
            <div class="flex gap-1.5">
              <button
                class="h-10 px-3.5 rounded-[10px] border border-[var(--et-border-strong)] bg-surface text-[14px] font-medium transition-colors hover:bg-[var(--et-surface-sunken)]"
                style="color:var(--et-text-2)"
                on:click={() => postpone(task.id)}
              >Morgen</button>
              <button
                class="h-10 px-3.5 rounded-[10px] border border-[var(--et-border-strong)] bg-surface text-[14px] font-medium transition-colors hover:bg-[var(--et-surface-sunken)]"
                style="color:var(--et-text-2)"
                on:click={() => moveTaskToPool(task.id)}
              >In den Pool</button>
              <button
                class="h-10 px-3.5 rounded-[10px] border text-[14px] font-medium transition-colors hover:bg-[var(--et-accent-soft)]"
                style="border-color:var(--et-accent);color:var(--et-accent-strong);background:var(--et-surface)"
                on:click={() => markDone(task.id)}
              >Erledigt</button>
            </div>
          </div>
        {:else}
          <p class="px-4 py-4 border-t border-[var(--et-border-subtle)] text-[14px]" style="color:var(--et-text-3)">
            {tasks.length === 0 ? 'Für diesen Tag war nichts geplant.' : 'Alles erledigt. Nichts mehr offen.'}
          </p>
        {/each}
      </div>

      <div class="flex flex-col gap-2 p-4 rounded-[14px] border border-border bg-surface">
        <label for="day-highlight" class="text-[12px] font-semibold uppercase tracking-[0.05em]" style="color:var(--et-text-3)">Highlight des Tages</label>
        <textarea
          id="day-highlight"
          class="w-full px-3 py-2.5 rounded-[9px] border border-[var(--et-border-strong)] bg-surface text-[14px] resize-y leading-relaxed"
          bind:value={highlight}
          placeholder="Was war heute besonders gut?"
          rows={3}
        ></textarea>
        <span class="text-[12px]" style="color:var(--et-text-3)">Erscheint in „Heute“ oben, solange dieser Tag offen ist.</span>
      </div>

      <div class="flex items-center gap-3">
        <button
          class="inline-flex items-center gap-1.5 min-h-[44px] text-[14px] font-medium"
          style="color:var(--et-accent)"
          on:click={backToWork}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"></path></svg>
          Zurück zum Arbeiten
        </button>
        <span class="flex-1"></span>
        <button
          class="inline-flex items-center gap-2 h-11 px-[18px] rounded-[10px] text-white font-semibold transition-colors hover:bg-[var(--et-accent-strong)]"
          style="background:var(--et-accent)"
          on:click={closeDay}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg>
          Tag abschließen
        </button>
      </div>
    </section>
  </div>
</div>
