<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { $pomodoroRunning as runningStore, $pomodoroSeconds as secondsStore, $focusTaskId as focusIdStore } from '../stores/uiStore';
  import { $tasks as tasksStore } from '../stores/taskStore';
  import { notifyPomodoroComplete, requestPermission } from '../lib/notifications';

  const WORK_DURATION = 25 * 60;

  $: running = $runningStore;
  $: seconds = $secondsStore;
  $: focusId = $focusIdStore;
  $: tasks = $tasksStore;
  $: focusTask = focusId ? tasks.find(t => t.id === focusId) : null;

  $: minutes = Math.floor(seconds / 60);
  $: secs = seconds % 60;
  $: progress = 1 - seconds / WORK_DURATION;
  $: circumference = 2 * Math.PI * 28;

  let interval: ReturnType<typeof setInterval> | null = null;

  $: {
    if (interval) clearInterval(interval);
    if (running) {
      interval = setInterval(() => {
        const current = secondsStore.get();
        if (current <= 1) {
          secondsStore.set(0);
          runningStore.set(false);
          notifyPomodoroComplete(focusTask?.title);
        } else {
          secondsStore.set(current - 1);
        }
      }, 1000);
    }
  }

  onMount(() => requestPermission());
  onDestroy(() => { if (interval) clearInterval(interval); });

  function reset() { runningStore.set(false); secondsStore.set(WORK_DURATION); }
  function toggle() { runningStore.set(!running); }
</script>

<div class="bg-surface rounded-2xl shadow-card border border-border p-6 flex flex-col items-center gap-4">
  <div class="text-center flex flex-col gap-1 max-w-full">
    <div class="flex items-center justify-center gap-1.5">
      <h3 class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">Fokus</h3>
      {#if running}
        <span class="w-1.5 h-1.5 rounded-full bg-success animate-pulse-subtle" aria-label="läuft"></span>
      {/if}
    </div>
    {#if focusTask}
      <span class="text-[13px] text-secondary overflow-hidden text-ellipsis whitespace-nowrap max-w-[220px]" title={focusTask.title}>{focusTask.title}</span>
    {:else}
      <span class="text-[13px] text-muted italic">Wähle eine Aufgabe</span>
    {/if}
  </div>

  <div class="relative w-[120px] h-[120px] flex items-center justify-center">
    <svg class="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
      <circle class="ring-bg" cx="32" cy="32" r="28" />
      <circle
        class="ring-fill"
        cx="32" cy="32" r="28"
        stroke-dasharray={circumference}
        stroke-dashoffset={circumference * (1 - progress)}
      />
    </svg>
    <span class="text-[28px] font-semibold tabular-nums text-primary relative" aria-live="polite">
      {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </span>
  </div>

  <div class="flex items-center gap-3">
    <button
      class="px-3 py-1 text-secondary rounded-lg text-[13px] hover:bg-gray-100 transition-colors text-lg"
      on:click={reset}
      aria-label="Zurücksetzen"
    >↺</button>
    <button
      class="px-5 py-2 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-blue-600 transition-colors"
      on:click={toggle}
    >{running ? 'Pause' : 'Start'}</button>
  </div>

  <p class="text-[12px] text-muted">
    {running ? 'Läuft — bleib fokussiert.' : seconds === WORK_DURATION ? '25-Min-Session' : 'Pausiert'}
  </p>
</div>

<style>
  .ring-bg {
    fill: none;
    stroke: var(--color-border);
    stroke-width: 4;
  }
  .ring-fill {
    fill: none;
    stroke: var(--color-accent);
    stroke-width: 4;
    stroke-linecap: round;
    transition: stroke-dashoffset 1s linear;
  }
</style>
