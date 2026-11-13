<!-- @module:planning -->
<script lang="ts">
  import { onMount } from 'svelte';
  import {
    $pomodoroRunning as runningStore,
    $pomodoroSeconds as secondsStore,
    $pomodoroSessionMinutes as sessionMinutesStore,
    $pomodoroMode as modeStore,
    $pomodoroSessionCount as sessionCountStore,
    $focusTaskId as focusIdStore,
  } from '../../stores/uiStore';
  import { $tasks as tasksStore } from '../../stores/taskStore';
  import { today } from '../../domain/dateUtils';
  import { requestPermission } from '../../lib/notifications';
  import { togglePomodoro, startPomodoroBreak, cancelPomodoro, adjustPomodoroDuration } from '../../lib/pomodoroTimer';
  import { hoverLift, pageReveal } from '../../lib/motionActions';

  $: running = $runningStore;
  $: seconds = $secondsStore;
  $: sessionMinutes = $sessionMinutesStore;
  $: mode = $modeStore;
  $: sessionCount = $sessionCountStore;
  $: focusId = $focusIdStore;
  $: tasks = $tasksStore;
  $: focusTask = focusId ? tasks.find(t => t.id === focusId) : null;

  // Today's planned open tasks (plus the currently focused one) for the selector
  $: todayTasks = tasks.filter(t => t.id === focusId || (t.status !== 'done' && t.plannedDate === today()));

  $: displayMinutes = Math.floor(seconds / 60);
  $: displaySecs = seconds % 60;

  // Session display: total session duration in m:ss
  $: sessionDisplayMinutes = mode === 'break' ? 5 : sessionMinutes;
  $: sessionDisplaySecs = 0;

  onMount(() => requestPermission());

  function selectTask(id: string) {
    focusIdStore.set(id || null);
  }
</script>

<div class="bg-surface rounded-2xl shadow-card border border-border p-4" use:pageReveal={{ delay: 0.04 }} use:hoverLift>
  <!-- Header row: mode indicator + task selector -->
  <div class="flex items-center gap-3 mb-3">
    <span class="text-[11px] font-bold uppercase tracking-[0.07em] {mode === 'break' ? 'text-success' : 'text-muted'}">
      {mode === 'break' ? 'Pause-Zeit' : 'Fokus'}
    </span>
    {#if running}
      <span class="w-1.5 h-1.5 rounded-full {mode === 'break' ? 'bg-success' : 'bg-accent'} animate-pulse-subtle" aria-label="läuft"></span>
    {/if}
    <div class="ml-auto">
      <select
        class="text-[12px] text-secondary bg-transparent border border-border rounded px-2 py-0.5 max-w-[160px] truncate cursor-pointer hover:border-accent transition-colors"
        value={focusId ?? ''}
        on:change={(e) => selectTask(e.currentTarget.value)}
        aria-label="Aufgabe auswählen"
      >
        <option value="">Aufgabe auswählen</option>
        {#each todayTasks as task (task.id)}
          <option value={task.id}>{task.title}</option>
        {/each}
      </select>
    </div>
  </div>

  <!-- Main content row -->
  <div class="flex items-center gap-6">
    <!-- Time columns -->
    <div class="flex gap-5 flex-1">
      <!-- Remaining time -->
      <div class="flex flex-col items-center gap-0.5">
        <span class="text-[10px] text-muted uppercase tracking-wider">Verbleibend</span>
        <span class="text-[26px] font-semibold tabular-nums text-primary leading-none" aria-live="polite">
          {String(displayMinutes).padStart(1, '0')}:{String(displaySecs).padStart(2, '0')}
        </span>
        <!-- +5 / -5 duration adjustment (only in work mode) -->
        {#if mode === 'work'}
          <div class="flex items-center gap-1 mt-0.5">
            <button
              class="text-[11px] text-muted hover:text-accent transition-colors px-1 disabled:opacity-40 disabled:pointer-events-none"
              disabled={running}
              on:click={() => adjustPomodoroDuration(5)}
              aria-label="+5 Minuten"
              title="+5 min"
            >+5</button>
            <button
              class="text-[11px] text-muted hover:text-accent transition-colors px-1 disabled:opacity-40 disabled:pointer-events-none"
              disabled={running}
              on:click={() => adjustPomodoroDuration(-5)}
              aria-label="-5 Minuten"
              title="-5 min"
            >-5</button>
          </div>
        {/if}
      </div>

      <!-- Session duration -->
      <div class="flex flex-col items-center gap-0.5">
        <span class="text-[10px] text-muted uppercase tracking-wider">Session</span>
        <span class="text-[26px] font-semibold tabular-nums text-secondary leading-none">
          {sessionDisplayMinutes}:00
        </span>
        <span class="text-[11px] text-muted mt-0.5">
          {sessionCount} heute
        </span>
      </div>
    </div>

    <!-- Action buttons -->
    <div class="flex flex-col gap-1.5">
      <button class="et-btn et-btn-primary min-w-[110px]" on:click={togglePomodoro}>
        {#if running}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect></svg>
          Pause
        {:else}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg>
          Start
        {/if}
      </button>

      {#if mode === 'work'}
        <button class="et-btn min-w-[110px]" on:click={startPomodoroBreak}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM16 10h2a2 2 0 0 1 0 4h-2M8 3v3M12 3v3"></path></svg>
          Pause machen
        </button>
      {/if}

      <button class="et-btn et-btn-danger min-w-[110px]" on:click={cancelPomodoro}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>
        Abbrechen
      </button>
    </div>
  </div>
</div>
