<!-- @module:time-tracking -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { $activeTaskId as activeTaskIdStore, $activeEntry as activeEntryStore, startTaskTimer, stopActiveTimer } from '../../stores/timerStore';
  import { formatTrackedTime, formatElapsed, entrySeconds } from '../../domain/dateUtils';
  import { $timeEntries as timeEntriesStore } from '../../stores/timerStore';

  export let taskId: string;
  /** `round`: always visible 36 px play button; running state is a blue „läuft“ pill with stop symbol. */
  export let variant: 'inline' | 'round' = 'inline';

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
    return $timeEntriesStore.filter(e => e.taskId === id && e.endAt).reduce((s, e) => s + entrySeconds(e), 0);
  }

  $: trackedSeconds = getTaskTrackedSeconds(taskId);
  $: label = isActive ? (elapsed || '0s') : (trackedSeconds > 0 ? formatTrackedTime(trackedSeconds) : '');

  function handleClick(e: MouseEvent) {
    e.stopPropagation();
    if (isActive) stopActiveTimer(); else startTaskTimer(taskId);
  }
</script>

{#if variant === 'round'}
  <button
    class="timer-btn flex items-center justify-center gap-2 flex-shrink-0 transition-colors {isActive ? 'h-9 px-3 rounded-full text-[13px] font-semibold' : 'w-9 h-9 rounded-full border border-[var(--et-border-strong)] bg-surface hover:bg-[var(--et-surface-sunken)]'}"
    style={isActive ? 'background:var(--et-accent-soft);color:var(--et-accent-strong)' : 'color:var(--et-text-2)'}
    on:click={handleClick}
    title={isActive ? 'Timer stoppen' : 'Timer starten'}
    aria-label={isActive ? 'Timer stoppen' : 'Timer starten'}
  >
    {#if isActive}
      <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="2" fill="currentColor"></rect></svg>
      <span>läuft</span>
    {:else}
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.500v9l7.500-4.500z" fill="currentColor"></path></svg>
    {/if}
  </button>
{:else}
  <button
    class="timer-btn flex items-center gap-[3px] px-1 rounded text-[11px] text-muted transition-colors flex-shrink-0 whitespace-nowrap opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-bg hover:text-primary {isActive ? '!opacity-100 text-accent bg-accent-subtle' : ''}"
    on:click={handleClick}
    title={isActive ? 'Timer stoppen' : 'Timer starten'}
    aria-label={isActive ? 'Timer stoppen' : 'Timer starten'}
  >
    {#if isActive}
      <svg class="animate-pulse" width="10" height="10" viewBox="0 0 12 12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="2" fill="currentColor"></rect></svg>
    {:else}
      <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.500v9l7.500-4.500z" fill="currentColor"></path></svg>
    {/if}
    {#if label}<span class="tabular-nums">{label}</span>{/if}
  </button>
{/if}
