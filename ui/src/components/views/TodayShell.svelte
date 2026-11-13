<!-- @core -->
<script lang="ts">
  import { onMount } from 'svelte';
  import {
    $todayPhase as todayPhaseStore,
    $focusOpen as focusOpenStore,
    $showShutdown as showShutdownStore,
  } from '../../stores/uiStore';
  import { $activeDate as activeDateStore } from '../../stores/taskStore';
  import { formatDate } from '../../domain/dateUtils';
  import type { TodayPhase } from '../../domain/types';
  import DailyPlanningView from './DailyPlanningView.svelte';
  import TodayView from './TodayView.svelte';
  import PomodoroWidget from '../widgets/PomodoroWidget.svelte';
  import TaskColumn from '../widgets/TaskColumn.svelte';
  import { pageReveal } from '../../lib/motionActions';

  const STEPS: { id: TodayPhase; label: string }[] = [
    { id: 'plan', label: 'Planen' },
    { id: 'work', label: 'Arbeiten' },
    { id: 'close', label: 'Abschließen' },
  ];

  $: phase = $todayPhaseStore;
  $: focusOpen = $focusOpenStore;

  // „Abschließen“ opens the shutdown dialog (ShutdownModal); closing it returns to „Arbeiten“.
  $: if (phase === 'close') showShutdownStore.set(true);

  onMount(() => showShutdownStore.subscribe(open => {
    if (!open && todayPhaseStore.get() === 'close') todayPhaseStore.set('work');
  }));

  function setPhase(next: TodayPhase) {
    todayPhaseStore.set(next);
  }
</script>

<div class="flex-1 flex flex-col overflow-hidden">
  <header class="flex items-center gap-4 px-8 pt-5 pb-3 flex-shrink-0">
    <h1 class="text-[24px] font-bold tracking-[-0.01em] text-primary flex-1">{formatDate($activeDateStore)}</h1>
    <div class="flex gap-1 rounded-xl p-1" style="background:var(--et-track)" role="group" aria-label="Schritte des Tages">
      {#each STEPS as step, i (step.id)}
        <button
          class="min-h-[36px] px-4 rounded-lg text-[13px] font-medium transition-colors {phase === step.id ? 'bg-surface text-primary font-semibold' : 'text-secondary hover:text-primary'}"
          style={phase === step.id ? 'box-shadow:var(--et-shadow-segment)' : ''}
          aria-pressed={phase === step.id}
          on:click={() => setPhase(step.id)}
        >{i + 1} {step.label}</button>
      {/each}
    </div>
    {#if phase === 'work'}
      <button
        class="min-h-[36px] px-4 rounded-lg border text-[13px] font-medium transition-colors {focusOpen ? 'border-accent text-accent bg-accent-subtle' : 'border-border text-secondary hover:bg-bg hover:text-primary'}"
        aria-pressed={focusOpen}
        on:click={() => focusOpenStore.set(!focusOpen)}
      >Fokus</button>
    {/if}
  </header>

  <div class="flex-1 overflow-hidden flex flex-col">
    {#if phase === 'plan'}
      <DailyPlanningView />
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
