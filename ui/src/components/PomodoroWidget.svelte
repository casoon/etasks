<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    $pomodoroRunning as runningStore,
    $pomodoroSeconds as secondsStore,
    $pomodoroSessionMinutes as sessionMinutesStore,
    $pomodoroMode as modeStore,
    $pomodoroSessionCount as sessionCountStore,
    $focusTaskId as focusIdStore,
  } from '../stores/uiStore';
  import { $tasks as tasksStore } from '../stores/taskStore';
  import { notifyPomodoroComplete, requestPermission } from '../lib/notifications';

  const BREAK_DURATION = 5 * 60;

  $: running = $runningStore;
  $: seconds = $secondsStore;
  $: sessionMinutes = $sessionMinutesStore;
  $: mode = $modeStore;
  $: sessionCount = $sessionCountStore;
  $: focusId = $focusIdStore;
  $: tasks = $tasksStore;
  $: focusTask = focusId ? tasks.find(t => t.id === focusId) : null;

  // Today's open tasks for the selector
  $: todayTasks = tasks.filter(t => t.status !== 'done');

  $: displayMinutes = Math.floor(seconds / 60);
  $: displaySecs = seconds % 60;

  // Session display: total session duration in m:ss
  $: sessionDisplayMinutes = mode === 'break' ? 5 : sessionMinutes;
  $: sessionDisplaySecs = 0;

  let interval: ReturnType<typeof setInterval> | null = null;

  $: {
    if (interval) clearInterval(interval);
    if (running) {
      interval = setInterval(() => {
        const current = secondsStore.get();
        const currentMode = modeStore.get();
        if (current <= 1) {
          secondsStore.set(0);
          runningStore.set(false);
          if (currentMode === 'work') {
            sessionCountStore.set(sessionCountStore.get() + 1);
            notifyPomodoroComplete(focusIdStore.get() ? tasksStore.get().find(t => t.id === focusIdStore.get())?.title : undefined);
          } else {
            // Break ended: return to work mode
            modeStore.set('work');
            secondsStore.set(sessionMinutesStore.get() * 60);
          }
        } else {
          secondsStore.set(current - 1);
        }
      }, 1000);
    }
  }

  onMount(() => requestPermission());
  onDestroy(() => { if (interval) clearInterval(interval); });

  function toggle() { runningStore.set(!running); }

  function startBreak() {
    modeStore.set('break');
    secondsStore.set(BREAK_DURATION);
    runningStore.set(true);
  }

  function cancel() {
    runningStore.set(false);
    modeStore.set('work');
    secondsStore.set(sessionMinutesStore.get() * 60);
  }

  function adjustDuration(delta: number) {
    const current = sessionMinutesStore.get();
    const next = Math.min(90, Math.max(5, current + delta));
    sessionMinutesStore.set(next);
    // Reset timer only if not running and in work mode
    if (!runningStore.get() && modeStore.get() === 'work') {
      secondsStore.set(next * 60);
    }
  }

  function selectTask(id: string) {
    focusIdStore.set(id || null);
  }
</script>

<div class="bg-surface rounded-2xl shadow-card border border-border p-4">
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
              class="text-[11px] text-muted hover:text-accent transition-colors px-1"
              on:click={() => adjustDuration(5)}
              aria-label="+5 Minuten"
              title="+5 min"
            >+5</button>
            <button
              class="text-[11px] text-muted hover:text-accent transition-colors px-1"
              on:click={() => adjustDuration(-5)}
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
      <button
        class="px-3 py-1 bg-accent text-white rounded-lg text-[12px] font-medium hover:bg-blue-600 transition-colors flex items-center gap-1.5 min-w-[80px] justify-center"
        on:click={toggle}
        aria-label={running ? 'Pausieren' : 'Starten'}
      >
        {#if running}
          <span>⏸</span> Pause
        {:else}
          <span>▶</span> Start
        {/if}
      </button>

      {#if mode === 'work'}
        <button
          class="px-3 py-1 bg-surface border border-border text-secondary rounded-lg text-[12px] font-medium hover:border-success hover:text-success transition-colors min-w-[80px]"
          on:click={startBreak}
          aria-label="Pause starten"
        >
          ☕ Pause
        </button>
      {/if}

      <button
        class="px-3 py-1 bg-surface border border-border text-muted rounded-lg text-[12px] font-medium hover:border-red-400 hover:text-red-500 transition-colors min-w-[80px]"
        on:click={cancel}
        aria-label="Abbrechen"
      >
        × Abbruch
      </button>
    </div>
  </div>
</div>
