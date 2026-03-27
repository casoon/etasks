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

<div class="pomodoro card">
  <div class="pomo-header">
    <h3 class="pomo-title">Fokus</h3>
    {#if focusTask}
      <span class="pomo-task" title={focusTask.title}>{focusTask.title}</span>
    {:else}
      <span class="pomo-task pomo-task--empty">Wähle eine Aufgabe</span>
    {/if}
  </div>

  <div class="pomo-timer-wrap">
    <svg class="pomo-ring" viewBox="0 0 64 64" aria-hidden="true">
      <circle class="pomo-ring-bg" cx="32" cy="32" r="28" />
      <circle
        class="pomo-ring-fill"
        cx="32" cy="32" r="28"
        stroke-dasharray={circumference}
        stroke-dashoffset={circumference * (1 - progress)}
      />
    </svg>
    <span class="pomo-time" aria-live="polite">
      {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </span>
  </div>

  <div class="pomo-controls">
    <button class="btn-ghost pomo-reset" on:click={reset} aria-label="Zurücksetzen">↺</button>
    <button class="btn-primary pomo-start" on:click={toggle}>{running ? 'Pause' : 'Start'}</button>
  </div>

  <p class="pomo-hint">
    {running ? 'Läuft — bleib fokussiert.' : seconds === WORK_DURATION ? '25-Min-Session' : 'Pausiert'}
  </p>
</div>
