<!-- @core -->
<script lang="ts">
  import { onMount } from 'svelte';
  import {
    $todayPhase as todayPhaseStore,
    $focusOpen as focusOpenStore,
  } from '../../stores/uiStore';
  import { $activeDate as activeDateStore, $todayTasks as todayTasksStore } from '../../stores/taskStore';
  import { $termine as termineStore } from '../../stores/terminStore';
  import { $bridgeTimeEntries as timeEntriesStore } from '../../stores/coreBridge';
  import { $activeEntry as activeEntryStore, stopActiveTimer } from '../../stores/timerStore';
  import { $appConfig as appConfigStore } from '../../stores/configStore';
  import { addDaysToKey, formatDate, formatHm, isoWeekNumber, today } from '../../domain/dateUtils';
  import { formatClock, taskCapacityMinutes, trackedSecondsOn } from '../../lib/dayStats';
  import type { TodayPhase } from '../../domain/types';
  import DailyPlanningView from './DailyPlanningView.svelte';
  import TodayView from './TodayView.svelte';
  import TodayCloseView from './TodayCloseView.svelte';
  import PomodoroWidget from '../widgets/PomodoroWidget.svelte';
  import TaskColumn from '../widgets/TaskColumn.svelte';
  import { pageReveal } from '../../lib/motionActions';

  const STEPS: { id: TodayPhase; label: string }[] = [
    { id: 'plan', label: 'Planen' },
    { id: 'work', label: 'Arbeiten' },
    { id: 'close', label: 'Abschließen' },
  ];

  let nowMs = Date.now();
  onMount(() => {
    const id = setInterval(() => { nowMs = Date.now(); }, 1000);
    return () => clearInterval(id);
  });

  $: phase = $todayPhaseStore;
  $: focusOpen = $focusOpenStore;
  $: activeDate = $activeDateStore;
  $: isToday = activeDate === today();
  $: tasks = $todayTasksStore;
  $: openCount = tasks.filter(t => t.status === 'todo').length;
  $: doneCount = tasks.length - openCount;
  $: activeEntry = $activeEntryStore;
  $: activeTask = activeEntry ? $todayTasksStore.find(t => t.id === activeEntry.taskId) : undefined;

  $: plannedMinutes = tasks.reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0);
  $: terminMinutes = $termineStore
    .filter(t => t.date === activeDate)
    .reduce((s, t) => s + t.durationMinutes, 0);
  $: trackedMinutes = Math.round(trackedSecondsOn($timeEntriesStore, activeDate, nowMs) / 60);
  $: bufferMinutes = taskCapacityMinutes(terminMinutes) - plannedMinutes;

  // Shutdown time from the profile: from then on the step bar points to „Abschließen“.
  $: shutdownTime = $appConfigStore?.profile?.shutdown_time?.trim() ?? '';
  $: nowHHMM = new Date(nowMs).toTimeString().slice(0, 5);
  $: closeDue = isToday && !!shutdownTime && nowHHMM >= shutdownTime && phase !== 'close';

  $: weekLabel = `KW ${isoWeekNumber(activeDate)}`;
  $: contextLine =
    phase === 'plan'
      ? `${weekLabel} · ${openCount} ${openCount === 1 ? 'Aufgabe' : 'Aufgaben'} für heute ausgewählt`
      : phase === 'work'
        ? `${weekLabel} · ${openCount} offen · ${doneCount} erledigt`
        : `${weekLabel} · ${nowHHMM} · ${activeEntry ? 'Timer läuft' : 'kein Timer aktiv'}`;
  $: hint =
    phase === 'plan'
      ? 'Aufgaben aus dem Pool wählen, Top 3 markieren, in den Kalender ziehen.'
      : phase === 'work'
        ? tasks.length === 0
          ? 'Noch nichts geplant. Im Schritt Planen Aufgaben für den Tag wählen.'
          : shutdownTime
            ? `Der Tag ist geplant. Arbeite die Liste ab – der Abschluss wird ab ${shutdownTime} vorgeschlagen.`
            : 'Der Tag ist geplant. Arbeite die Liste ab.'
        : 'Offenes verschieben, Highlight notieren, Tag abschließen.';

  function setPhase(next: TodayPhase) {
    todayPhaseStore.set(next);
  }
  function shiftDay(n: number) {
    activeDateStore.set(addDaysToKey(activeDate, n));
  }
</script>

<div class="flex-1 flex flex-col overflow-hidden">
  <header class="flex flex-wrap items-center gap-x-4 gap-y-3 px-8 pt-5 pb-4 flex-shrink-0">
    <div class="flex flex-col gap-0.5 flex-1 min-w-[260px]">
      <h1 class="text-[24px] font-bold tracking-[-0.01em] text-primary leading-tight">{formatDate(activeDate)}</h1>
      <span class="text-[13px]" style="color:var(--et-text-3)">{contextLine}</span>
    </div>

    {#if activeEntry}
      <div class="flex items-center gap-3 h-11 pl-4 pr-1.5 rounded-[10px]" style="background:var(--et-accent-soft);color:var(--et-accent-strong)">
        <span class="w-2 h-2 rounded-full animate-pulse" style="background:var(--et-accent)" aria-hidden="true"></span>
        <span class="text-[14px] font-semibold max-w-[220px] truncate">{activeTask?.title ?? 'Timer läuft'}</span>
        <span class="text-[14px] font-semibold tabular-nums" role="timer" aria-label="Laufzeit">{formatClock((nowMs - new Date(activeEntry.startAt).getTime()) / 1000)}</span>
        <button
          class="w-9 h-9 flex items-center justify-center rounded-lg transition-colors hover:bg-white/60"
          style="color:var(--et-accent-strong)"
          aria-label="Timer stoppen"
          on:click={() => stopActiveTimer()}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="2" fill="currentColor"></rect></svg>
        </button>
      </div>
    {/if}

    <div class="flex items-center gap-1">
      <button
        class="w-11 h-11 flex items-center justify-center rounded-[10px] border border-border bg-surface text-primary transition-colors hover:bg-[var(--et-surface-sunken)]"
        aria-label="Vorheriger Tag"
        on:click={() => shiftDay(-1)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"></path></svg>
      </button>
      <button
        class="h-11 px-3.5 rounded-[10px] border border-border bg-surface text-primary font-semibold transition-colors hover:bg-[var(--et-surface-sunken)] disabled:cursor-not-allowed"
        style={isToday ? 'background:var(--et-border);color:var(--et-text-3)' : ''}
        disabled={isToday}
        on:click={() => activeDateStore.set(today())}
      >Heute</button>
      <button
        class="w-11 h-11 flex items-center justify-center rounded-[10px] border border-border bg-surface text-primary transition-colors hover:bg-[var(--et-surface-sunken)]"
        aria-label="Nächster Tag"
        on:click={() => shiftDay(1)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>
      </button>
    </div>
  </header>

  <div class="flex flex-wrap items-center gap-x-4 gap-y-3 px-8 pb-5 flex-shrink-0">
    <div class="flex gap-1 p-1 rounded-xl" style="background:var(--et-track)" role="group" aria-label="Tagesablauf">
      {#each STEPS as step, i (step.id)}
        {@const current = phase === step.id}
        {@const done = STEPS.findIndex(s => s.id === phase) > i}
        <button
          class="flex items-center gap-2 h-10 px-3.5 rounded-[9px] text-[14px] transition-colors {current ? 'bg-surface text-primary font-semibold' : 'font-medium hover:bg-white/50'}"
          style="{current ? 'box-shadow:var(--et-shadow-segment);' : 'color:var(--et-text-2);'}"
          aria-current={current ? 'step' : undefined}
          on:click={() => setPhase(step.id)}
        >
          <span
            class="w-5 h-5 rounded-full flex items-center justify-center text-[12px] font-semibold box-border"
            style={current
              ? 'background:var(--et-accent);color:#fff'
              : done
                ? 'background:var(--et-success);color:#fff'
                : step.id === 'close' && closeDue
                  ? 'background:var(--et-warning);color:#fff'
                  : 'border:1.5px solid var(--et-border-control)'}
          >
            {#if done}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg>
              <span class="sr-only">erledigt, </span>
            {:else}{i + 1}{/if}
          </span>
          <span>{step.label}</span>
          {#if step.id === 'close' && closeDue}
            <span class="text-[12px] font-semibold px-2 py-0.5 rounded-md" style="background:var(--et-warning-soft);color:var(--et-warning-text)">ab {shutdownTime}</span>
          {/if}
        </button>
      {/each}
    </div>

    <span class="flex-1 min-w-[240px] text-[13px]" style="color:var(--et-text-3)">{hint}</span>

    {#if phase === 'work' && tasks.length > 0}
      <div class="flex items-center gap-4 text-[13px]" style="color:var(--et-text-3)">
        <span>Geplant <strong class="font-semibold text-primary">{formatHm(plannedMinutes)}</strong></span>
        <span>Erfasst <strong class="font-semibold text-primary">{formatHm(trackedMinutes)}</strong></span>
        <span>{bufferMinutes < 0 ? 'Zuviel' : 'Puffer'} <strong class="font-semibold" style="color:{bufferMinutes < 0 ? 'var(--et-danger)' : 'var(--et-success-text)'}">{formatHm(Math.abs(bufferMinutes))}</strong></span>
      </div>
    {/if}

    {#if phase === 'work'}
      <button
        class="h-11 px-4 rounded-[10px] border text-[14px] font-medium transition-colors {focusOpen ? 'border-accent text-accent bg-accent-subtle' : 'border-[var(--et-border-strong)] bg-surface hover:bg-[var(--et-surface-sunken)]'}"
        style={focusOpen ? '' : 'color:var(--et-text-2)'}
        aria-pressed={focusOpen}
        on:click={() => focusOpenStore.set(!focusOpen)}
      >Fokus</button>
    {:else if phase === 'plan'}
      <button
        class="flex items-center h-11 px-[18px] rounded-[10px] text-white font-semibold transition-colors hover:bg-[var(--et-accent-strong)]"
        style="background:var(--et-accent)"
        on:click={() => setPhase('work')}
      >
        Tag starten
        <svg class="ml-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>
      </button>
    {/if}
  </div>

  <div class="flex-1 overflow-hidden flex flex-col">
    {#if phase === 'plan'}
      <DailyPlanningView />
    {:else if phase === 'close'}
      <TodayCloseView />
    {:else if focusOpen}
      <div
        class="flex-1 grid overflow-y-auto px-8 pb-6 gap-6 items-start"
        style="grid-template-columns: 280px 1fr"
        use:pageReveal={{ distance: 18 }}
      >
        <PomodoroWidget />
        <TaskColumn />
      </div>
    {:else}
      <TodayView />
    {/if}
  </div>
</div>
