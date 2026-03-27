<script lang="ts">
  import { onDestroy } from 'svelte';
  import { $activeTaskId as activeTaskIdStore, $activeEntry as activeEntryStore, startTaskTimer, stopActiveTimer } from '../stores/timerStore';
  import { formatTrackedTime, formatElapsed } from '../domain/dateUtils';
  import { $timeEntries as timeEntriesStore } from '../stores/timerStore';

  export let taskId: string;

  $: isActive = $activeTaskIdStore === taskId;
  $: activeEntry = $activeEntryStore;

  let elapsed = '';
  let interval: ReturnType<typeof setInterval> | null = null;

  $: {
    if (interval) { clearInterval(interval); interval = null; }
    if (isActive && activeEntry) {
      elapsed = formatElapsed(activeEntry.startedAt);
      interval = setInterval(() => { elapsed = formatElapsed(activeEntry!.startedAt); }, 1000);
    } else {
      elapsed = '';
    }
  }

  onDestroy(() => { if (interval) clearInterval(interval); });

  function getTaskTrackedSeconds(id: string): number {
    return $timeEntriesStore.filter(e => e.taskId === id && e.stoppedAt).reduce((s, e) => s + e.durationSeconds, 0);
  }

  $: trackedSeconds = getTaskTrackedSeconds(taskId);
  $: label = isActive ? (elapsed || '0s') : (trackedSeconds > 0 ? formatTrackedTime(trackedSeconds) : '');

  function handleClick(e: MouseEvent) {
    e.stopPropagation();
    if (isActive) stopActiveTimer(); else startTaskTimer(taskId);
  }
</script>

<button
  class="timer-btn {isActive ? 'timer-btn--active' : ''}"
  on:click={handleClick}
  title={isActive ? 'Timer stoppen' : 'Timer starten'}
  aria-label={isActive ? 'Timer stoppen' : 'Timer starten'}
>
  <span class="timer-btn-icon">{isActive ? '⏹' : '▶'}</span>
  {#if label}<span class="timer-btn-label">{label}</span>{/if}
</button>
