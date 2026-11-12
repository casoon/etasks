<!-- @module:time-tracking -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { $activeEntry as activeEntryStore, stopActiveTimer, discardActiveTimer } from '../../stores/timerStore';
  import { $tasks as tasksStore } from '../../stores/taskStore';
  import { isStaleEntry } from '../../lib/timerService';
  import { formatTrackedTime } from '../../domain/dateUtils';

  let open = false;
  let stopTime = '';
  let error = '';

  $: entry = $activeEntryStore;
  $: task = entry ? $tasksStore.find(t => t.id === entry!.taskId) : null;

  // Only at app start: a running entry from a previous day or open for over 12 hours.
  onMount(() => {
    const e = activeEntryStore.get();
    if (e && isStaleEntry(e)) open = true;
  });

  function stopAtTime() {
    if (!entry) return;
    const [h, m] = stopTime.split(':').map(Number);
    const end = new Date(entry.startAt);
    end.setHours(h, m, 0, 0);
    // Time of day on the start day; if it lies before the start, take the next day.
    if (end.getTime() < new Date(entry.startAt).getTime()) end.setDate(end.getDate() + 1);
    if (!stopTime || Number.isNaN(end.getTime()) || end.getTime() > Date.now()) {
      error = 'Bitte eine Uhrzeit angeben, die nicht in der Zukunft liegt.';
      return;
    }
    stopActiveTimer(end.toISOString());
    open = false;
  }

  function stopNow() { stopActiveTimer(); open = false; }
  function discard() { discardActiveTimer(); open = false; }
</script>

{#if open && entry}
  <div class="fixed inset-0 bg-black/40 flex items-start justify-center pt-[20vh] z-[100] backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Vergessener Timer">
    <div class="bg-surface border border-border rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] w-[460px] max-w-[calc(100vw-32px)] p-5 flex flex-col gap-4">
      <p class="text-[14px] font-semibold text-primary">Ein Timer läuft noch</p>
      <p class="text-[13px] text-secondary leading-relaxed">
        „{task?.title ?? 'Gelöschte Aufgabe'}“ läuft seit {new Date(entry.startAt).toLocaleString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        ({formatTrackedTime(Math.round((Date.now() - new Date(entry.startAt).getTime()) / 1000))}). Was soll mit dem Eintrag passieren?
      </p>
      <div class="flex items-center gap-2 flex-wrap">
        <label class="text-[12px] text-secondary" for="stale-stop-time">Beenden um</label>
        <input id="stale-stop-time" type="time" class="border border-border rounded-md px-2 py-1 text-[13px] bg-bg" bind:value={stopTime} on:input={() => (error = '')} />
        <button class="px-3 py-1.5 rounded-lg border border-border text-[13px] text-secondary hover:bg-bg hover:text-primary transition-colors" on:click={stopAtTime}>Zu dieser Zeit beenden</button>
      </div>
      {#if error}<p class="text-[12px] text-red-500">{error}</p>{/if}
      <div class="flex items-center gap-2 justify-end">
        <button class="px-3 py-1.5 rounded-lg text-[13px] text-secondary hover:bg-bg transition-colors" on:click={discard}>Verwerfen</button>
        <button class="px-3 py-1.5 rounded-lg bg-accent text-white text-[13px] font-medium hover:bg-blue-600 transition-colors" on:click={stopNow}>Jetzt stoppen</button>
      </div>
    </div>
  </div>
{/if}
