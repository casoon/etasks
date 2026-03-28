<script lang="ts">
  import {
    $todayTasks as todayTasksStore,
    $completionRate as completionRateStore,
    toggleTask,
    updateTask,
    $activeDate as activeDateStore,
  } from '../stores/taskStore';
  import { $mitTaskIds as mitTaskIdsStore } from '../stores/planningStore';
  import { $projects as projectsStore } from '../stores/projectStore';
  import { $focusTaskId as focusTaskIdStore } from '../stores/uiStore';
  import { $todayBlocks as todayBlocksStore } from '../stores/calendarStore';
  import { $timeEntries as timeEntriesStore } from '../stores/timerStore';
  import type { Task } from '../domain/types';
  import { onMount, onDestroy } from 'svelte';

  $: tasks = $todayTasksStore;
  $: completionRate = $completionRateStore;
  $: mitIds = $mitTaskIdsStore;
  $: projects = $projectsStore;
  $: todayBlocks = $todayBlocksStore;
  $: allTimeEntries = $timeEntriesStore;
  $: activeDate = $activeDateStore;

  $: mitTasks = mitIds
    .map(id => tasks.find(t => t.id === id))
    .filter((t): t is Task => t !== undefined);
  $: otherTasks = tasks.filter(t => !mitIds.includes(t.id));
  $: doneCount  = tasks.filter(t => t.status === 'done').length;
  $: todoCount  = tasks.filter(t => t.status === 'todo').length;
  $: totalMinutes = tasks.reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0);
  $: totalLabel = totalMinutes >= 60
    ? `${Math.floor(totalMinutes / 60)}h${totalMinutes % 60 > 0 ? '\u202f' + totalMinutes % 60 + 'min' : ''}`
    : totalMinutes > 0 ? `${totalMinutes}\u202fmin` : null;

  // CTA-Zustand
  $: ctaState = tasks.length === 0
    ? 'empty'
    : mitIds.length === 0 ? 'partial' : 'planned';

  function projectColor(task: Task): string | null {
    if (!task.projectId) return null;
    return projects.find(p => p.id === task.projectId)?.color ?? null;
  }
  function projectName(task: Task): string | null {
    if (!task.projectId) return null;
    return projects.find(p => p.id === task.projectId)?.name ?? null;
  }
  function startFocus(task: Task) {
    focusTaskIdStore.set(task.id);
    (document.querySelector('[data-nav="focus"]') as HTMLElement)?.click();
  }
  function goToPlanning() {
    (document.querySelector('[data-nav="planning-daily"]') as HTMLElement)?.click();
  }

  // ── Calendar panel ─────────────────────────────────────────────────────────

  const CAL_START_H = 7;   // 07:00
  const CAL_END_H   = 20;  // 20:00
  const HOUR_PX     = 64;
  const TOTAL_PX    = (CAL_END_H - CAL_START_H) * HOUR_PX; // 832px
  const HOURS       = Array.from({ length: CAL_END_H - CAL_START_H + 1 }, (_, i) => CAL_START_H + i);

  /** Parse "HH:MM" or ISO string → minutes since midnight. Returns -1 on failure. */
  function parseTimeToMinutes(time: string): number {
    if (!time) return -1;
    // ISO string: "2026-03-28T09:00:00" or "2026-03-28T09:00:00.000Z"
    if (time.includes('T')) {
      const timePart = time.split('T')[1];
      if (!timePart) return -1;
      const [hStr, mStr] = timePart.split(':');
      const h = parseInt(hStr, 10);
      const m = parseInt(mStr, 10);
      if (isNaN(h) || isNaN(m)) return -1;
      return h * 60 + m;
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
    const raw = Math.max(28, estimatedMinutes ?? 28);
    const maxH = TOTAL_PX - topPx;
    return Math.min(raw, maxH);
  }

  // Current time indicator
  let nowMinutes = 0;
  let nowLineTop = -1;

  function updateNow() {
    const d = new Date();
    nowMinutes = d.getHours() * 60 + d.getMinutes();
    const top = minutesToTop(nowMinutes);
    nowLineTop = (top >= 0 && top <= TOTAL_PX) ? top : -1;
  }

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
    if (!dragging) return;
    const rawMin = CAL_START_H * 60 + Math.round(((e.offsetY - dragging.offsetPx) / HOUR_PX) * 60 / 15) * 15;
    const clampedMin = Math.max(CAL_START_H * 60, Math.min((CAL_END_H - 0.25) * 60, rawMin));
    dragY = minutesToTop(clampedMin);
  }

  function onCalendarMouseUp(e: MouseEvent) {
    if (!dragging) return;
    const rawMin = CAL_START_H * 60 + Math.round(((e.offsetY - dragging.offsetPx) / HOUR_PX) * 60 / 15) * 15;
    const newMin = Math.max(CAL_START_H * 60, Math.min((CAL_END_H - 0.25) * 60, rawMin));
    const newTimeStr =
      String(Math.floor(newMin / 60)).padStart(2, '0') + ':' +
      String(newMin % 60).padStart(2, '0');
    updateTask(dragging.taskId, { scheduledStart: newTimeStr });
    dragging = null;
  }

  function onDocumentMouseUp() {
    if (dragging) dragging = null;
  }

  // Actual time entries for today within calendar range
  $: todayEntries = allTimeEntries.filter(e => {
    if (!e.startAt || !e.durationMinutes) return false;
    const entryDate = e.startAt.slice(0, 10);
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
    const m = parseTimeToMinutes(b.start);
    return m >= CAL_START_H * 60 && m < CAL_END_H * 60;
  });
</script>

<!--
  2-column layout: left = task list, right = day calendar
-->
<div class="flex-1 overflow-hidden flex">

  <!-- ── LEFT: Task list ──────────────────────────────────────────────────── -->
  <div class="w-[380px] flex-shrink-0 overflow-y-auto border-r border-border">
    <div class="max-w-[560px] mx-auto px-8 py-8 flex flex-col gap-7">

      <!-- ── Seitenheader ── -->
      <div>
        <h1 class="text-[22px] font-bold text-primary leading-tight">Dein Überblick für heute</h1>
        {#if tasks.length > 0}
          <div class="flex items-center gap-2 mt-3 flex-wrap">
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg rounded-full text-[12px] font-medium text-secondary border border-border">
              {todoCount} {todoCount === 1 ? 'Aufgabe' : 'Aufgaben'} offen
            </span>
            {#if totalLabel}
              <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg rounded-full text-[12px] font-medium text-secondary border border-border">
                ⏱ {totalLabel} geplant
              </span>
            {/if}
            {#if doneCount > 0}
              <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-success/10 text-success border border-success/20">
                ✓ {doneCount} erledigt
              </span>
            {/if}
          </div>
          <div class="mt-3 h-2 bg-border rounded-full overflow-hidden">
            <div
              class="h-full bg-success rounded-full transition-[width] duration-500"
              style="width:{completionRate}%"
            />
          </div>
        {/if}
      </div>

      <!-- ── CTA: kontextsensitiv ── -->
      {#if ctaState === 'empty'}
        <!-- Button IS das visuelle Zentrum, nicht die Box -->
        <div class="py-4 flex flex-col items-center text-center gap-5">
          <div>
            <p class="text-[16px] font-semibold text-primary">Heute ist noch nichts geplant.</p>
            <p class="text-[13px] text-muted mt-1">Leg jetzt fest, was du heute erledigen möchtest.</p>
          </div>
          <button
            class="px-8 py-3 rounded-xl text-[15px] font-bold transition-colors"
            style="background-color: var(--color-accent); color: white;"
            on:click={goToPlanning}
          >Tag planen →</button>
        </div>

        <!-- Placeholder-Struktur: macht klar "hier entsteht später dein Dashboard" -->
        <div class="rounded-2xl border border-border bg-surface shadow-card overflow-hidden opacity-40 pointer-events-none select-none">
          <div class="px-5 pt-4 pb-3 border-b border-border">
            <p class="text-[10px] font-bold uppercase tracking-[0.09em] text-muted mb-3">Top 3 Prioritäten</p>
            {#each [1, 2, 3] as _}
              <div class="flex items-center gap-3 py-2">
                <div class="w-4 h-4 rounded border-2 border-border flex-shrink-0"></div>
                <div class="h-2.5 bg-border rounded-full flex-1"></div>
                <div class="h-2.5 w-10 bg-border rounded-full"></div>
              </div>
            {/each}
          </div>
          <div class="px-5 py-3 flex gap-5">
            <span class="text-[11px] text-muted">Geplante Zeit: –</span>
            <span class="text-[11px] text-muted">Fortschritt: –</span>
          </div>
        </div>

      {:else if ctaState === 'partial'}
        <div class="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
          <p class="text-[13px] text-amber-900 leading-snug">
            {todoCount === 1 ? 'Eine Aufgabe' : todoCount + ' Aufgaben'} geplant — Top\u202f3 fehlen noch.
          </p>
          <button
            class="text-[12px] font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap"
            on:click={goToPlanning}
          >Planung bearbeiten →</button>
        </div>
      {/if}

      <!-- ── Top 3 Prioritäten ── -->
      {#if mitTasks.length > 0}
        <div>
          <h2 class="text-[11px] font-bold uppercase tracking-[0.09em] text-muted mb-3">Top 3 Prioritäten</h2>
          <div class="flex flex-col gap-3">
            {#each mitTasks as task (task.id)}
              {@const col = projectColor(task)}
              {@const proj = projectName(task)}
              <div
                class="rounded-2xl border border-border bg-surface shadow-card overflow-hidden group
                  border-l-[4px] {task.status === 'done' ? 'border-l-success' : 'border-l-accent'}"
              >
                <div class="flex items-start gap-4 px-5 py-4">
                  <button
                    class="mt-[2px] w-5 h-5 flex-shrink-0 rounded-md border-2 flex items-center justify-center transition-colors
                      {task.status === 'done' ? 'bg-success border-success text-white' : 'border-accent hover:bg-accent/10'}"
                    on:click={() => toggleTask(task.id)}
                  >
                    {#if task.status === 'done'}<span class="text-[11px] leading-none">✓</span>{/if}
                  </button>
                  <div class="flex-1 min-w-0">
                    <p class="text-[15px] font-semibold leading-snug {task.status === 'done' ? 'line-through text-muted' : 'text-primary'}">
                      {task.title}
                    </p>
                    {#if proj}
                      <p class="text-[11px] text-muted mt-1.5 flex items-center gap-1.5">
                        {#if col}<span class="w-2 h-2 rounded-full inline-block flex-shrink-0" style="background:{col}"></span>{/if}
                        {proj}
                      </p>
                    {/if}
                  </div>
                  <div class="flex items-center gap-2 flex-shrink-0 mt-[2px]">
                    {#if task.estimatedMinutes}
                      <span class="text-[12px] text-muted">{task.estimatedMinutes < 60 ? task.estimatedMinutes + 'min' : (task.estimatedMinutes / 60) + 'h'}</span>
                    {/if}
                    {#if task.status !== 'done'}
                      <button
                        class="w-8 h-8 flex items-center justify-center rounded-xl bg-accent text-white text-[12px] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent/80"
                        on:click={() => startFocus(task)}
                        title="Im Fokus starten"
                      >▶</button>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- ── Geplante Aufgaben ── -->
      {#if otherTasks.length > 0}
        <div>
          <h2 class="text-[11px] font-bold uppercase tracking-[0.09em] text-muted mb-3">
            {mitTasks.length > 0 ? 'Weitere Aufgaben' : 'Geplante Aufgaben'}
          </h2>
          <div class="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
            {#each otherTasks as task, i (task.id)}
              {@const col = projectColor(task)}
              <div
                class="flex items-center gap-3 px-5 py-3.5 group {i > 0 ? 'border-t border-border' : ''}
                  hover:bg-bg transition-colors"
              >
                <button
                  class="w-[18px] h-[18px] flex-shrink-0 rounded-[5px] border-2 flex items-center justify-center transition-colors
                    {task.status === 'done' ? 'bg-success border-success text-white' : 'border-border-strong hover:border-accent'}"
                  on:click={() => toggleTask(task.id)}
                >
                  {#if task.status === 'done'}<span class="text-[10px] leading-none">✓</span>{/if}
                </button>
                {#if col}
                  <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{col}" />
                {/if}
                <span class="flex-1 text-[13px] min-w-0 truncate {task.status === 'done' ? 'line-through text-muted' : 'text-primary'}">
                  {task.title}
                </span>
                {#if task.estimatedMinutes}
                  <span class="text-[11px] text-muted flex-shrink-0">{task.estimatedMinutes < 60 ? task.estimatedMinutes + 'min' : (task.estimatedMinutes / 60) + 'h'}</span>
                {/if}
                {#if task.status !== 'done'}
                  <button
                    class="w-6 h-6 flex items-center justify-center rounded-lg text-muted opacity-0 group-hover:opacity-100 hover:text-accent transition-all text-[10px]"
                    on:click={() => startFocus(task)}
                    title="Im Fokus starten"
                  >▶</button>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

    </div>
  </div>

  <!-- ── RIGHT: Day calendar ──────────────────────────────────────────────── -->
  <div class="flex-1 overflow-y-auto bg-bg">
    <div class="px-4 pt-6 pb-4">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-[11px] font-bold uppercase tracking-[0.09em] text-muted">Tagesplan</h2>
        <div class="flex items-center gap-3 text-[10px] text-muted">
          <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm border border-accent/60 bg-accent/15 inline-block"></span>Geplant</span>
          <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-accent/50 inline-block"></span>Erfasst</span>
        </div>
      </div>

      <!-- Calendar grid -->
      <div
        bind:this={calendarEl}
        class="relative"
        style="height:{TOTAL_PX}px;"
        on:mousemove={onCalendarMouseMove}
        on:mouseup={onCalendarMouseUp}
      >
        <!-- Hour rows -->
        {#each HOURS as hour}
          {@const isLast = hour === CAL_END_H}
          <div
            class="absolute left-0 right-0 border-t border-border/50 flex items-start"
            style="top:{(hour - CAL_START_H) * HOUR_PX}px; height:{isLast ? 0 : HOUR_PX}px;"
          >
            <span class="text-[11px] text-muted w-9 flex-shrink-0 select-none leading-none pt-1">
              {String(hour).padStart(2, '0')}
            </span>
          </div>
        {/each}

        <!-- Task blocks GEPLANT (left half) -->
        {#each scheduledTasks as task (task.id)}
          {@const startMin = parseTimeToMinutes(task.scheduledStart ?? '')}
          {@const top = minutesToTop(startMin)}
          {@const height = blockHeight(top, task.estimatedMinutes)}
          {@const col = projectColor(task) ?? 'var(--color-accent)'}
          {@const durLabel = task.estimatedMinutes
            ? (task.estimatedMinutes < 60 ? task.estimatedMinutes + 'min' : Math.floor(task.estimatedMinutes / 60) + 'h' + (task.estimatedMinutes % 60 > 0 ? '\u202f' + task.estimatedMinutes % 60 + 'min' : ''))
            : null}
          {@const isDragging = dragging?.taskId === task.id}
          <div
            class="absolute rounded-lg px-2 py-1 overflow-hidden select-none"
            style="top:{top}px; height:{height}px; left:36px; right:calc(50% + 2px); background-color:{col}18; border-left: 3px solid {col}; border: 1px solid {col}44; border-left: 3px solid {col}; cursor:grab; opacity:{isDragging ? 0.35 : 1}; transition: opacity 0.1s;"
            title="{task.title} (geplant)"
            on:mousedown={(e) => onTaskMouseDown(e, task)}
          >
            <p class="text-[11px] font-semibold truncate leading-tight" style="color:{col};">
              {task.title}
            </p>
            {#if height >= 40 && durLabel}
              <p class="text-[10px] leading-tight" style="color:{col}; opacity:0.7;">{durLabel}</p>
            {/if}
          </div>
        {/each}

        <!-- Ghost block during drag -->
        {#if dragging}
          {@const dragTask = scheduledTasks.find(t => t.id === dragging!.taskId)}
          {#if dragTask}
            {@const col = projectColor(dragTask) ?? 'var(--color-accent)'}
            {@const height = blockHeight(dragY, dragTask.estimatedMinutes)}
            <div
              class="absolute rounded-lg px-2 py-1 overflow-hidden select-none pointer-events-none"
              style="top:{dragY}px; height:{height}px; left:36px; right:calc(50% + 2px); background-color:{col}30; border: 2px dashed {col}; opacity:0.7; z-index:20;"
            >
              <p class="text-[11px] font-semibold truncate leading-tight" style="color:{col};">
                {dragTask.title}
              </p>
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
          {@const col      = block.color ?? 'var(--color-accent)'}
          <div
            class="absolute rounded-lg px-2 py-1 overflow-hidden cursor-default select-none"
            style="top:{top}px; height:{height}px; left:36px; right:calc(50% + 2px); background-color:{col}18; border: 1px solid {col}44; border-left: 3px solid {col};"
            title="{block.title ?? ''} (geplant)"
          >
            {#if block.title}
              <p class="text-[11px] font-semibold truncate leading-tight" style="color:{col};">{block.title}</p>
            {/if}
          </div>
        {/each}

        <!-- Time entry blocks TATSÄCHLICH (right half, solid) -->
        {#each todayEntries as entry (entry.id)}
          {@const startMin = parseTimeToMinutes(entry.startAt)}
          {@const top = minutesToTop(startMin)}
          {@const height = blockHeight(top, entry.durationMinutes)}
          {@const taskForEntry = tasks.find(t => t.id === entry.taskId)}
          {@const col = (taskForEntry ? projectColor(taskForEntry) : null) ?? 'var(--color-accent)'}
          {@const durLabel = entry.durationMinutes
            ? (entry.durationMinutes < 60 ? entry.durationMinutes + 'min' : Math.floor(entry.durationMinutes / 60) + 'h' + (entry.durationMinutes % 60 > 0 ? '\u202f' + entry.durationMinutes % 60 + 'min' : ''))
            : null}
          <div
            class="absolute rounded-lg px-2 py-1 overflow-hidden cursor-default select-none"
            style="top:{top}px; height:{height}px; left:calc(50% + 2px); right:8px; background-color:{col}55; border-left: 3px solid {col};"
            title="{taskForEntry?.title ?? 'Zeiterfassung'} (erfasst)"
          >
            {#if height >= 28}
              <p class="text-[11px] font-semibold truncate leading-tight" style="color:{col};">
                {taskForEntry?.title ?? '–'}
              </p>
            {/if}
            {#if height >= 44 && durLabel}
              <p class="text-[10px] leading-tight" style="color:{col}; opacity:0.8;">{durLabel}</p>
            {/if}
          </div>
        {/each}

        <!-- Current time indicator -->
        {#if nowLineTop >= 0}
          <div
            class="absolute left-0 right-0 pointer-events-none z-10 flex items-center"
            style="top:{nowLineTop}px;"
          >
            <div class="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 ml-8"></div>
            <div class="flex-1 h-[2px] bg-red-500 rounded-full"></div>
          </div>
        {/if}
      </div>
    </div>
  </div>

</div>
