<!-- @core -->
<script lang="ts">
  import {
    $todayTasks as todayTasksStore,
    $tasks as allTasksStore,
    toggleTask,
    updateTask,
    addTask,
    $activeDate as activeDateStore,
  } from '../../stores/taskStore';
  import { $mitTaskIds as mitTaskIdsStore, $dailyIntention as intentionStore, setIntention } from '../../stores/planningStore';
  import { $projects as projectsStore } from '../../stores/projectStore';
  import { openToday } from '../../stores/uiStore';
  import { $todayBlocks as todayBlocksStore, moveBlock } from '../../stores/calendarStore';
  import { $termine as termineStore } from '../../stores/terminStore';
  import { dayHourRange } from '../../domain/calendarService';
  import { $bridgeTimeEntries as timeEntriesStore } from '../../stores/coreBridge';
  import { entrySeconds, formatHm, toDateKeyFromIso, today } from '../../domain/dateUtils';
  import { loadNotes } from '../../lib/db';
  import type { Task } from '../../domain/types';
  import TimerButton from '../widgets/TimerButton.svelte';
  import { onMount, onDestroy } from 'svelte';

  $: tasks = $todayTasksStore;
  $: mitIds = $mitTaskIdsStore;
  $: projects = $projectsStore;
  $: projectMap = new Map(projects.map(p => [p.id, p]));
  $: todayBlocks = $todayBlocksStore;
  $: allTimeEntries = $timeEntriesStore;
  $: activeDate = $activeDateStore;
  $: isToday = activeDate === today();
  $: todayTermine = $termineStore
    .filter(t => t.date === activeDate)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Highlight des Tages from the day close
  $: todayHighlight = loadNotes().find(n => n.date === activeDate)?.highlight ?? '';

  $: mitTasks = mitIds
    .map(id => tasks.find(t => t.id === id))
    .filter((t): t is Task => t !== undefined);
  let showDone = false;
  $: otherAll = tasks.filter(t => !mitIds.includes(t.id));
  $: otherTasks = showDone ? otherAll : otherAll.filter(t => t.status === 'todo');
  $: otherDoneCount = otherAll.filter(t => t.status === 'done').length;
  $: otherOpenCount = otherAll.filter(t => t.status === 'todo').length;
  $: mitDoneCount = mitTasks.filter(t => t.status === 'done').length;
  $: poolCount = $allTasksStore.filter(t => t.status === 'todo' && !t.recurrence && t.plannedDate !== activeDate).length;

  function projectColor(task: Task): string | null {
    return task.projectId ? (projectMap.get(task.projectId)?.color ?? null) : null;
  }
  function projectLabel(task: Task): string | null {
    return task.projectId ? (projectMap.get(task.projectId)?.name ?? null) : null;
  }

  function slotLabel(task: Task): string {
    const parts: string[] = [];
    if (task.scheduledStart) {
      const d = new Date(task.scheduledStart);
      if (!isNaN(d.getTime())) parts.push(d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
    }
    if (task.estimatedMinutes) parts.push(formatHm(task.estimatedMinutes));
    return parts.join(' · ');
  }
  function timeLabel(task: Task): string {
    const tracked = Math.round((task.trackedSeconds ?? 0) / 60);
    if (task.status === 'done') return tracked > 0 ? `${formatHm(tracked)} erfasst` : '';
    if (tracked > 0) return task.estimatedMinutes ? `${formatHm(tracked)} / ${formatHm(task.estimatedMinutes)}` : `${formatHm(tracked)} erfasst`;
    return slotLabel(task);
  }

  // Add a task for the active day
  let adding = false;
  let newTitle = '';
  function handleAdd(e: Event) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    addTask(newTitle.trim(), 30);
    newTitle = '';
  }

  // ── Calendar panel ─────────────────────────────────────────────────────────

  let CAL_START_H = 8;
  let CAL_END_H   = 18;
  const HOUR_PX     = 56;
  const toHM = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  // Widen the grid for appointments, scheduled tasks and captured time outside 08–18
  $: rangeItems = [
    ...todayTermine,
    ...tasks.filter(t => t.scheduledStart).map(t => ({ startTime: toHM(t.scheduledStart!), durationMinutes: t.estimatedMinutes ?? 30 })),
    ...allTimeEntries
      .filter(e => e.startAt && toDateKeyFromIso(e.startAt) === activeDate)
      .map(e => ({ startTime: toHM(e.startAt), durationMinutes: Math.max(1, Math.round(entrySeconds(e) / 60)) })),
  ];
  $: ({ start: CAL_START_H, end: CAL_END_H } = dayHourRange(8, 18, rangeItems));
  $: TOTAL_PX = (CAL_END_H - CAL_START_H) * HOUR_PX;
  $: HOURS = Array.from({ length: CAL_END_H - CAL_START_H + 1 }, (_, i) => CAL_START_H + i);

  /** Parse "HH:MM" or ISO string → minutes since midnight. Returns -1 on failure. */
  function parseTimeToMinutes(time: string): number {
    if (!time) return -1;
    // ISO string: converted to local time
    if (time.includes('T')) {
      const d = new Date(time);
      if (isNaN(d.getTime())) return -1;
      return d.getHours() * 60 + d.getMinutes();
    }
    // "HH:MM"
    const parts = time.split(':');
    if (parts.length < 2) return -1;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return -1;
    return h * 60 + m;
  }

  /** Returns top offset in px for a given minutes-since-midnight value */
  function minutesToTop(totalMinutes: number): number {
    return (totalMinutes - CAL_START_H * 60) * (HOUR_PX / 60);
  }

  /** Returns height in px for estimatedMinutes, min 28px, clipped to cal end */
  function blockHeight(topPx: number, estimatedMinutes: number | null | undefined): number {
    const raw = Math.max(28, (estimatedMinutes ?? 28) * (HOUR_PX / 60));
    const maxH = TOTAL_PX - topPx;
    return Math.min(raw, maxH);
  }

  // Current time indicator
  let nowMinutes = 0;
  let nowLineTop = -1;
  let nowLabel = '';

  function updateNow() {
    const d = new Date();
    nowMinutes = d.getHours() * 60 + d.getMinutes();
    const top = minutesToTop(nowMinutes);
    nowLineTop = (isToday && top >= 0 && top <= TOTAL_PX) ? top : -1;
    nowLabel = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  // Redraw when the day or the grid range changes
  $: if (isToday !== undefined && TOTAL_PX) updateNow();

  let nowInterval: ReturnType<typeof setInterval>;
  onMount(() => {
    updateNow();
    nowInterval = setInterval(updateNow, 60_000);
    document.addEventListener('mouseup', onDocumentMouseUp);
  });
  onDestroy(() => {
    clearInterval(nowInterval);
    document.removeEventListener('mouseup', onDocumentMouseUp);
  });

  // ── Drag & drop state ────────────────────────────────────────────────────────
  let dragging: { taskId: string; offsetPx: number } | null = null;
  let dragY = 0; // visual top offset in px for the ghost block
  let calendarEl: HTMLElement;
  const TERMIN_LABELS = { video: 'Video', phone: 'Telefon', onsite: 'Vor Ort' } as const;

  function onTaskMouseDown(e: MouseEvent, task: Task) {
    e.preventDefault();
    const blockTop = (e.currentTarget as HTMLElement).getBoundingClientRect().top;
    const offsetPx = e.clientY - blockTop;
    dragging = { taskId: task.id, offsetPx };
    // initialise dragY so ghost appears at current block position
    const startMin = parseTimeToMinutes(task.scheduledStart!);
    dragY = minutesToTop(startMin);
  }

  function onCalendarMouseMove(e: MouseEvent) {
    if (!dragging || !calendarEl) return;
    const rect = calendarEl.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const rawMin = CAL_START_H * 60 + Math.round(((relativeY - dragging.offsetPx) / HOUR_PX) * 60 / 15) * 15;
    const clampedMin = Math.max(CAL_START_H * 60, Math.min((CAL_END_H - 0.25) * 60, rawMin));
    dragY = minutesToTop(clampedMin);
  }

  function onCalendarMouseUp(e: MouseEvent) {
    if (!dragging || !calendarEl) return;
    const rect = calendarEl.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const rawMin = CAL_START_H * 60 + Math.round(((relativeY - dragging.offsetPx) / HOUR_PX) * 60 / 15) * 15;
    const newMin = Math.max(CAL_START_H * 60, Math.min((CAL_END_H - 0.25) * 60, rawMin));
    const newStart = new Date(activeDate + 'T00:00:00');
    newStart.setHours(Math.floor(newMin / 60), newMin % 60, 0, 0);
    updateTask(dragging.taskId, { scheduledStart: newStart.toISOString(), plannedDate: activeDate });
    const block = todayBlocks.find(b => b.taskId === dragging!.taskId);
    if (block) moveBlock(block.id, newStart);
    dragging = null;
  }

  function onDocumentMouseUp() {
    if (dragging) dragging = null;
  }

  // Actual time entries for today within calendar range
  $: todayEntries = allTimeEntries.filter(e => {
    if (!e.startAt || !entrySeconds(e)) return false;
    const entryDate = toDateKeyFromIso(e.startAt);
    const m = parseTimeToMinutes(e.startAt);
    return entryDate === activeDate && m >= CAL_START_H * 60 && m < CAL_END_H * 60;
  });

  // Tasks with a scheduled start that falls within calendar range
  $: scheduledTasks = tasks.filter(t => {
    if (!t.scheduledStart) return false;
    const m = parseTimeToMinutes(t.scheduledStart);
    return m >= CAL_START_H * 60 && m < CAL_END_H * 60;
  });

  // CalendarBlocks within range
  $: visibleBlocks = todayBlocks.filter(b => {
    // Blocks of scheduled tasks are already drawn as task blocks
    if (b.taskId && tasks.some(t => t.id === b.taskId && t.scheduledStart)) return false;
    const m = parseTimeToMinutes(b.start);
    return m >= CAL_START_H * 60 && m < CAL_END_H * 60;
  });
</script>

<div class="flex-1 overflow-y-auto px-8 pb-7">
  <div class="flex flex-wrap gap-4 items-start">

    <!-- ── Aufgaben heute ─────────────────────────────────────────────────── -->
    <section aria-label="Aufgaben heute" class="flex-[999] basis-[420px] min-w-0 flex flex-col gap-4">

      <div class="flex flex-col gap-1 px-4 py-3 rounded-[14px] border border-border bg-surface">
        <label for="day-intention" class="text-[12px] font-semibold uppercase tracking-[0.05em]" style="color:var(--et-text-3)">Intention</label>
        <input
          id="day-intention"
          class="w-full min-h-[36px] bg-transparent text-[15px] font-medium rounded-md"
          placeholder="Was soll heute am Ende stehen?"
          value={$intentionStore}
          on:input={e => setIntention(e.currentTarget.value)}
        />
        {#if todayHighlight}
          <p class="text-[13px] flex items-center gap-1.5" style="color:var(--et-text-3)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="color:var(--et-warning)" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9l-5.4 2.9 1.100-6.100L3.200 9.400l6.100-.8z"></path></svg>
            Highlight: {todayHighlight}
          </p>
        {/if}
      </div>

      <div>
        <div class="flex items-baseline gap-3 mb-2">
          <h2 class="flex-1 text-[15px] font-semibold">Top 3</h2>
          <span class="text-[13px]" style="color:var(--et-text-3)">{mitDoneCount} von {mitTasks.length || 3} erledigt</span>
        </div>
        {#if mitTasks.length === 0}
          <div class="flex flex-wrap items-center gap-3 px-4 py-3 rounded-[14px]" style="border:1.5px dashed var(--et-border-control)">
            <span class="flex-1 basis-[200px] text-[14px]" style="color:var(--et-text-2)">Noch keine Top 3 festgelegt. Im Schritt Planen markierst du die wichtigsten Aufgaben mit dem Stern.</span>
            <button
              class="h-10 px-3.5 rounded-[10px] border border-[var(--et-border-strong)] bg-surface text-[14px] font-medium hover:bg-[var(--et-surface-sunken)]"
              style="color:var(--et-text-2)"
              on:click={() => openToday('plan')}
            >Zur Planung</button>
          </div>
        {:else}
          <div class="flex flex-col gap-2">
            {#each mitTasks as task (task.id)}
              {@const col = projectColor(task)}
              {@const proj = projectLabel(task)}
              {@const done = task.status === 'done'}
              <div class="flex items-center gap-3 min-h-[64px] pl-2 pr-3 py-2 rounded-[14px] border border-border bg-surface">
                <button
                  class="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-lg"
                  aria-label={done ? 'Als offen markieren' : 'Als erledigt markieren'}
                  aria-pressed={done}
                  on:click={() => toggleTask(task.id)}
                >
                  <span
                    class="w-6 h-6 rounded-md flex items-center justify-center box-border"
                    style={done ? 'background:var(--et-success);color:#fff' : 'border:2px solid var(--et-border-control)'}
                  >
                    {#if done}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg>{/if}
                  </span>
                </button>
                <span class="flex-1 min-w-0 flex flex-col">
                  <span class="text-[15px] font-semibold truncate {done ? 'line-through' : ''}" style={done ? 'color:var(--et-text-3)' : ''}>{task.title}</span>
                  {#if proj}
                    <span class="flex items-center gap-1.5 text-[12px] truncate" style="color:var(--et-text-3)">
                      {#if col}<span class="w-[7px] h-[7px] rounded-full flex-shrink-0" style="background:{col}" aria-hidden="true"></span>{/if}
                      {proj}
                    </span>
                  {/if}
                </span>
                <span class="text-[13px] tabular-nums whitespace-nowrap" style="color:var(--et-text-3)">{timeLabel(task)}</span>
                {#if !done}<TimerButton taskId={task.id} variant="round" />{/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>

      {#if otherTasks.length > 0 || otherOpenCount > 0}
        <div>
          <div class="flex items-baseline gap-3 mb-2">
            <h2 class="flex-1 text-[15px] font-semibold">{mitTasks.length > 0 ? 'Weitere Aufgaben' : 'Aufgaben'}</h2>
            <span class="text-[13px]" style="color:var(--et-text-3)">{otherOpenCount} offen</span>
          </div>
          <div class="rounded-[14px] border border-border bg-surface overflow-hidden">
            {#each otherTasks as task, i (task.id)}
              {@const col = projectColor(task)}
              {@const done = task.status === 'done'}
              <div class="flex items-center gap-2 min-h-[52px] pl-2 pr-3 {i > 0 ? 'border-t border-[var(--et-border-subtle)]' : ''}">
                <button
                  class="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-lg"
                  aria-label={done ? 'Als offen markieren' : 'Als erledigt markieren'}
                  aria-pressed={done}
                  on:click={() => toggleTask(task.id)}
                >
                  <span
                    class="w-5 h-5 rounded-[5px] flex items-center justify-center box-border"
                    style={done ? 'background:var(--et-success);color:#fff' : 'border:2px solid var(--et-border-control)'}
                  >
                    {#if done}<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg>{/if}
                  </span>
                </button>
                {#if col}<span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{col}" aria-hidden="true"></span>{/if}
                <span class="flex-1 min-w-0 truncate {done ? 'line-through' : ''}" style={done ? 'color:var(--et-text-3)' : ''}>{task.title}</span>
                {#if !done && !task.scheduledStart}
                  <span class="text-[12px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap" style="background:var(--et-warning-soft);color:var(--et-warning-text)">ohne Zeitslot</span>
                {/if}
                <span class="text-[13px] tabular-nums whitespace-nowrap" style="color:var(--et-text-3)">{done ? timeLabel(task) : task.scheduledStart ? slotLabel(task) : (task.estimatedMinutes ? formatHm(task.estimatedMinutes) : '')}</span>
                {#if !done}<TimerButton taskId={task.id} variant="round" />{/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if tasks.length === 0}
        <div class="flex flex-col items-start gap-3 px-5 py-5 rounded-[14px] border border-border bg-surface">
          <div>
            <p class="text-[15px] font-semibold">Für diesen Tag ist noch nichts geplant.</p>
            <p class="text-[13px]" style="color:var(--et-text-3)">Wähle Aufgaben aus dem Pool oder lege direkt eine neue an.</p>
          </div>
          <button
            class="h-11 px-[18px] rounded-[10px] text-white font-semibold hover:bg-[var(--et-accent-strong)]"
            style="background:var(--et-accent)"
            on:click={() => openToday('plan')}
          >Tag planen</button>
        </div>
      {/if}

      <div class="flex flex-wrap items-center gap-2">
        {#if adding}
          <form class="flex items-center gap-2 flex-1 basis-[280px]" on:submit={handleAdd}>
            <label class="sr-only" for="today-new-task">Aufgabe für heute</label>
            <!-- svelte-ignore a11y-autofocus -->
            <input
              id="today-new-task"
              class="flex-1 min-w-0 h-11 px-3 rounded-[9px] border border-[var(--et-border-strong)] bg-surface"
              placeholder="Aufgabe für heute …"
              bind:value={newTitle}
              autofocus
              on:keydown={e => { if (e.key === 'Escape') { adding = false; newTitle = ''; } }}
            />
            <button type="submit" class="h-11 px-4 rounded-[10px] text-white font-semibold" style="background:var(--et-accent)">Hinzufügen</button>
            <button type="button" class="h-11 px-3 rounded-[10px] text-[14px] font-medium" style="color:var(--et-text-2)" on:click={() => { adding = false; newTitle = ''; }}>Abbrechen</button>
          </form>
        {:else}
          <button
            class="inline-flex items-center gap-2 h-11 px-3.5 rounded-[10px] border border-[var(--et-border-strong)] bg-surface text-[14px] font-medium hover:bg-[var(--et-surface-sunken)]"
            style="color:var(--et-text-2)"
            on:click={() => adding = true}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>
            Aufgabe für heute
          </button>
          {#if poolCount > 0}
            <button
              class="h-11 px-3.5 rounded-[10px] border border-[var(--et-border-strong)] bg-surface text-[14px] font-medium hover:bg-[var(--et-surface-sunken)]"
              style="color:var(--et-text-2)"
              on:click={() => openToday('plan')}
            >Aus dem Pool einplanen ({poolCount})</button>
          {/if}
          <span class="flex-1"></span>
          {#if otherDoneCount > 0}
            <button
              class="h-11 px-3.5 rounded-[10px] text-[14px] font-medium hover:bg-[var(--et-surface-sunken)]"
              style="color:var(--et-text-2)"
              aria-pressed={showDone}
              on:click={() => showDone = !showDone}
            >{showDone ? 'Erledigte ausblenden' : 'Erledigt anzeigen'} ({otherDoneCount})</button>
          {/if}
        {/if}
      </div>
    </section>

    <!-- ── Tagesplan ──────────────────────────────────────────────────────── -->
    <aside aria-label="Tagesplan" class="flex-1 basis-[300px] max-w-[420px] min-w-0 box-border flex flex-col gap-3 px-4 pt-3.5 pb-4 rounded-[14px] border border-border bg-surface">
      <div class="flex items-center gap-3">
        <h2 class="flex-1 text-[15px] font-semibold">Tagesplan</h2>
        <span class="flex items-center gap-1.5 text-[12px]" style="color:var(--et-text-3)"><span class="w-3 h-3 rounded-[3px] box-border" style="border:1.5px solid var(--et-accent);background:var(--et-accent-soft)" aria-hidden="true"></span>Geplant</span>
        <span class="flex items-center gap-1.5 text-[12px]" style="color:var(--et-text-3)"><span class="w-3 h-3 rounded-[3px]" style="background:var(--et-accent)" aria-hidden="true"></span>Erfasst</span>
      </div>

      <!-- Calendar grid (neu aufgebaut, wenn sich der Stundenbereich ändert) -->
      {#key `${CAL_START_H}-${CAL_END_H}`}
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div
        bind:this={calendarEl}
        class="relative"
        role="presentation"
        style="height:{TOTAL_PX}px;"
        on:mousemove={onCalendarMouseMove}
        on:mouseup={onCalendarMouseUp}
      >
        {#each HOURS as hour}
          {@const isLast = hour === CAL_END_H}
          <div
            class="absolute left-0 right-0 border-t border-[var(--et-border-subtle)] text-[12px] box-border pt-[3px]"
            style="top:{(hour - CAL_START_H) * HOUR_PX}px; height:{isLast ? 0 : HOUR_PX}px; color:var(--et-text-3)"
          >{#if !isLast}{String(hour).padStart(2, '0')}:00{/if}</div>
        {/each}

        <!-- Task blocks GEPLANT (left half, outlined) -->
        {#each scheduledTasks as task (task.id)}
          {@const startMin = parseTimeToMinutes(task.scheduledStart ?? '')}
          {@const top = minutesToTop(startMin)}
          {@const height = blockHeight(top, task.estimatedMinutes)}
          {@const col = projectColor(task) ?? 'var(--et-accent)'}
          {@const isDragging = dragging?.taskId === task.id}
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div
            class="absolute rounded-[7px] px-2 py-1 overflow-hidden select-none box-border"
            role="button"
            tabindex="0"
            style="top:{top}px; height:{height}px; left:44px; right:calc(50% + 2px); background:color-mix(in srgb, {col} 12%, white); border:1px solid {col}; cursor:grab; opacity:{isDragging ? 0.35 : 1}; transition: opacity 0.1s; color:color-mix(in srgb, {col} 70%, black)"
            title="{task.title} (geplant, per Ziehen verschieben)"
            on:mousedown={(e) => onTaskMouseDown(e, task)}
          >
            <p class="text-[12px] font-semibold truncate leading-tight">{task.title}</p>
            {#if height >= 40 && task.estimatedMinutes}
              <p class="text-[11px] leading-tight">{formatHm(task.estimatedMinutes)}</p>
            {/if}
          </div>
        {/each}

        <!-- Ghost block during drag -->
        {#if dragging}
          {@const dragTask = scheduledTasks.find(t => t.id === dragging?.taskId)}
          {#if dragTask}
            {@const col = projectColor(dragTask) ?? 'var(--et-accent)'}
            {@const height = blockHeight(dragY, dragTask.estimatedMinutes)}
            <div
              class="absolute rounded-[7px] px-2 py-1 overflow-hidden select-none pointer-events-none box-border"
              style="top:{dragY}px; height:{height}px; left:44px; right:calc(50% + 2px); background:color-mix(in srgb, {col} 20%, white); border: 2px dashed {col}; opacity:0.8; z-index:20;"
            >
              <p class="text-[12px] font-semibold truncate leading-tight" style="color:color-mix(in srgb, {col} 70%, black)">{dragTask.title}</p>
            </div>
          {/if}
        {/if}

        <!-- CalendarBlock items (left half, outlined) -->
        {#each visibleBlocks as block (block.id)}
          {@const startMin = parseTimeToMinutes(block.start)}
          {@const endMin   = parseTimeToMinutes(block.end)}
          {@const top      = minutesToTop(startMin)}
          {@const rawH     = endMin > startMin ? (endMin - startMin) * (HOUR_PX / 60) : 28}
          {@const height   = blockHeight(top, (rawH / HOUR_PX) * 60)}
          {@const col      = block.color ?? 'var(--et-accent)'}
          <div
            class="absolute rounded-[7px] px-2 py-1 overflow-hidden cursor-default select-none box-border"
            style="top:{top}px; height:{height}px; left:44px; right:calc(50% + 2px); background:color-mix(in srgb, {col} 12%, white); border:1px solid {col}; color:color-mix(in srgb, {col} 70%, black)"
            title="{block.title ?? ''} (geplant)"
          >
            {#if block.title}
              <p class="text-[12px] font-semibold truncate leading-tight">{block.title}</p>
            {/if}
          </div>
        {/each}

        <!-- Termine (left half) -->
        {#each todayTermine as termin (termin.id)}
          {@const startMin = parseTimeToMinutes(termin.startTime)}
          {@const top = minutesToTop(startMin)}
          {@const height = blockHeight(top, termin.durationMinutes)}
          <div
            class="absolute rounded-[7px] px-2 py-1 overflow-hidden cursor-default select-none box-border"
            style="top:{top}px; height:{height}px; left:44px; right:calc(50% + 2px); background:var(--et-appointment-soft); border:1px solid var(--et-appointment); color:var(--et-appointment-text); z-index:5;"
            title="{termin.startTime} · {termin.title}{termin.billable ? ' · abrechenbar' : ''}"
          >
            <p class="text-[12px] font-semibold truncate leading-tight">{termin.title}</p>
            {#if height >= 40}
              <p class="text-[11px] leading-tight">{termin.startTime} · {TERMIN_LABELS[termin.type]}{termin.billable ? ' · abrechenbar' : ''}</p>
            {/if}
          </div>
        {/each}

        <!-- Time entry blocks ERFASST (right half, filled) -->
        {#each todayEntries as entry (entry.id)}
          {@const startMin = parseTimeToMinutes(entry.startAt)}
          {@const top = minutesToTop(startMin)}
          {@const entryMin = Math.round(entrySeconds(entry) / 60)}
          {@const height = blockHeight(top, entryMin)}
          {@const taskForEntry = tasks.find(t => t.id === entry.taskId)}
          {@const col = (taskForEntry ? projectColor(taskForEntry) : null) ?? 'var(--et-accent)'}
          <div
            class="absolute rounded-[7px] px-2 py-1 overflow-hidden cursor-default select-none box-border"
            style="top:{top}px; height:{height}px; left:calc(50% + 2px); right:0; background:{col}; color:#fff"
            title="{taskForEntry?.title ?? 'Zeiterfassung'} (erfasst)"
          >
            {#if height >= 28}
              <p class="text-[12px] font-semibold truncate leading-tight">{taskForEntry?.title ?? '–'}{entry.endAt ? '' : ' · läuft'}</p>
            {/if}
            {#if height >= 44 && entryMin}
              <p class="text-[11px] leading-tight">{formatHm(entryMin)}</p>
            {/if}
          </div>
        {/each}

        <!-- Current time indicator -->
        {#if nowLineTop >= 0}
          <div class="absolute left-0 right-0 pointer-events-none z-10 flex items-center" style="top:{nowLineTop}px;" aria-hidden="true">
            <span class="text-[11px] font-semibold tabular-nums pr-1" style="color:var(--et-now)">{nowLabel}</span>
            <div class="w-2 h-2 rounded-full flex-shrink-0" style="background:var(--et-now)"></div>
            <div class="flex-1 h-[2px] rounded-full" style="background:var(--et-now)"></div>
          </div>
        {/if}
      </div>
      {/key}
    </aside>
  </div>
</div>
