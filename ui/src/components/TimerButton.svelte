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
      elapsed = formatElapsed(activeEntry.startAt);
      interval = setInterval(() => { elapsed = formatElapsed(activeEntry!.startAt); }, 1000);
    } else {
      elapsed = '';
    }
  }

  onDestroy(() => { if (interval) clearInterval(interval); });

  function getTaskTrackedSeconds(id: string): number {
    return $timeEntriesStore.filter(e => e.taskId === id && e.endAt).reduce((s, e) => s + (e.durationMinutes ?? 0) * 60, 0);
  }

  $: trackedSeconds = getTaskTrackedSeconds(taskId);
  $: label = isActive ? (elapsed || '0s') : (trackedSeconds > 0 ? formatTrackedTime(trackedSeconds) : '');

  function handleClick(e: MouseEvent) {
    e.stopPropagation();
    if (isActive) stopActiveTimer(); else startTaskTimer(taskId);
  }
</script>

<button
  class="timer-btn flex items-center gap-[3px] px-1 rounded text-[11px] text-muted transition-colors flex-shrink-0 whitespace-nowrap opacity-0 group-hover:opacity-100 hover:bg-bg hover:text-primary {isActive ? '!opacity-100 text-accent bg-accent-subtle' : ''}"
  on:click={handleClick}
  title={isActive ? 'Timer stoppen' : 'Timer starten'}
  aria-label={isActive ? 'Timer stoppen' : 'Timer starten'}
>
  <span class="text-[12px] leading-none {isActive ? 'animate-pulse' : ''}">{isActive ? '⏹' : '▶'}</span>
  {#if label}<span class="tabular-nums">{label}</span>{/if}
</button>
