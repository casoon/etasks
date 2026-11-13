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
  <div class="fixed inset-0 flex items-start justify-center pt-[20vh] z-[100]" style="background:rgba(28,27,25,0.45)" role="dialog" aria-modal="true" aria-labelledby="stale-title">
    <div class="w-[460px] max-w-[calc(100vw-32px)] p-5 flex flex-col gap-4 rounded-[14px]" style="background:var(--et-surface);border:1px solid var(--et-border);box-shadow:var(--et-shadow-overlay)">
      <h2 id="stale-title" class="et-h2">Ein Timer läuft noch</h2>
      <p class="text-[13px] leading-relaxed" style="color:var(--et-text-2)">
        „{task?.title ?? 'Gelöschte Aufgabe'}“ läuft seit {new Date(entry.startAt).toLocaleString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        ({formatTrackedTime(Math.round((Date.now() - new Date(entry.startAt).getTime()) / 1000))}). Was soll mit dem Eintrag passieren?
      </p>
      <div class="flex items-end gap-2 flex-wrap">
        <div class="flex flex-col gap-1">
          <label class="et-label" for="stale-stop-time">Beenden um</label>
          <input id="stale-stop-time" type="time" class="et-field w-auto" bind:value={stopTime} on:input={() => (error = '')} />
        </div>
        <button class="et-btn" on:click={stopAtTime}>Zu dieser Zeit beenden</button>
      </div>
      {#if error}<p class="text-[13px]" style="color:var(--et-danger)" role="alert">{error}</p>{/if}
      <div class="flex items-center gap-2 justify-end">
        <button class="et-btn et-btn-danger" on:click={discard}>Verwerfen</button>
        <button class="et-btn et-btn-primary" on:click={stopNow}>Jetzt stoppen</button>
      </div>
    </div>
  </div>
{/if}
