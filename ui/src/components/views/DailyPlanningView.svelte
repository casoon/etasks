<!-- @module:planning -->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import {
    $tasks as tasksStore,
    $activeDate as activeDateStore,
    addTask, updateTask, reorderTasks, cloneRecurringTask,
  } from '../../stores/taskStore';
  import { $todayBlocks as todayBlocksStore, dropTaskOnCalendar, removeBlockForTask } from '../../stores/calendarStore';
  import { $projects as projectsStore } from '../../stores/projectStore';
  import { $termine as termineStore } from '../../stores/terminStore';
  import { $dailyIntention as intentionStore, $mitTaskIds as mitStore, setIntention, toggleMit } from '../../stores/planningStore';
  import { $currentWeekPlan as currentWeekPlanStore } from '../../stores/weekPlanStore';
  import { daysSince, formatDate, isRecurringDueOn } from '../../domain/dateUtils';
  import { autoScheduleTasks } from '../../domain/taskService';
  import CalendarView from './CalendarView.svelte';
  import RecurringTasksPanel from '../widgets/RecurringTasksPanel.svelte';
  import type { Task } from '../../domain/types';
  import { getTaskDragData, setTaskDragData } from '../../lib/taskDrag';

  type PoolSortMode = 'manual' | 'date' | 'project';

  const TODAY_WIP_LIMIT = 5;
  const POOL_PREFS_KEY = 'etasks:planning:pool-prefs';

  let tasks: Task[] = tasksStore.get();
  let activeDate: string = activeDateStore.get();
  let intention: string = intentionStore.get();
  let mitIds: string[] = mitStore.get();
  let todayBlocks = todayBlocksStore.get();
  let termine = termineStore.get();

  onDestroy(tasksStore.subscribe(v => { tasks = [...v]; }));
  onDestroy(activeDateStore.subscribe(v => { activeDate = v; }));
  onDestroy(intentionStore.subscribe(v => { intention = v; }));
  onDestroy(mitStore.subscribe(v => { mitIds = [...v]; }));
  onDestroy(todayBlocksStore.subscribe(v => { todayBlocks = [...v]; }));
  onDestroy(termineStore.subscribe(v => { termine = [...v]; }));

  $: projects = $projectsStore;
  $: activeProjects = projects.filter(p => p.status === 'active');

  $: todayTasks = tasks
    .filter(t => t.plannedDate === activeDate && t.status === 'todo')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  $: focusProjectIds = $currentWeekPlanStore.focusProjectIds ?? [];
  let showAllProjects = false;
  let showRecurringManager = false;
  let poolSort: PoolSortMode = 'date';
  let collapsedPoolGroups: string[] = [];
  let limitWarning = '';
  let poolPrefsReady = false;

  onMount(() => {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = JSON.parse(localStorage.getItem(POOL_PREFS_KEY) ?? '{}');
      poolSort = raw.poolSort === 'manual' || raw.poolSort === 'project' ? raw.poolSort : 'date';
      collapsedPoolGroups = Array.isArray(raw.collapsedPoolGroups) ? raw.collapsedPoolGroups : [];
    } catch {
      poolSort = 'date';
      collapsedPoolGroups = [];
    }
    poolPrefsReady = true;
  });

  $: if (poolPrefsReady && typeof localStorage !== 'undefined') {
    localStorage.setItem(POOL_PREFS_KEY, JSON.stringify({ poolSort, collapsedPoolGroups }));
  }

  // Recurring tasks due today that don't already have a clone for today
  $: recurringTemplates = tasks.filter(t => t.recurrence && !t.sourceTaskId);
  $: recurringDueToday = recurringTemplates.filter(template => {
    if (!isRecurringDueOn(template.recurrence!, activeDate)) return false;
    // already cloned for today?
    return !tasks.some(t => t.sourceTaskId === template.id && t.plannedDate === activeDate);
  });

  function assignRecurringToToday(templateId: string) {
    cloneRecurringTask(templateId, activeDate);
  }

  function comparePoolTasks(a: Task, b: Task): number {
    if (poolSort === 'manual') return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (poolSort === 'project') {
      const aProject = a.projectId ? (projects.find(p => p.id === a.projectId)?.name ?? 'Ohne Projekt') : 'Ohne Projekt';
      const bProject = b.projectId ? (projects.find(p => p.id === b.projectId)?.name ?? 'Ohne Projekt') : 'Ohne Projekt';
      const byProject = aProject.localeCompare(bProject, 'de');
      if (byProject !== 0) return byProject;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    }
    const byDate = (b.plannedDate ?? '').localeCompare(a.plannedDate ?? '');
    if (byDate !== 0) return byDate;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  }

  $: poolTasksAll = tasks
    .filter(t => t.status === 'todo' && t.plannedDate !== activeDate)
    .sort(comparePoolTasks);

  $: poolTasks = (focusProjectIds.length === 0 || showAllProjects
    ? poolTasksAll
    : poolTasksAll.filter(t => !t.projectId || focusProjectIds.includes(t.projectId)));

  $: poolGroups = (() => {
    const grouped = new Map<string, { id: string; label: string; color: string | null; tasks: Task[] }>();
    for (const task of poolTasks) {
      const project = task.projectId ? projects.find(p => p.id === task.projectId) : null;
      const id = project?.id ?? 'ohne-projekt';
      const existing = grouped.get(id);
      if (existing) {
        existing.tasks.push(task);
      } else {
        grouped.set(id, {
          id,
          label: project?.name ?? 'Ohne Projekt',
          color: project?.color ?? null,
          tasks: [task],
        });
      }
    }
    return [...grouped.values()];
  })();

  $: hasAnyTodoTasks = tasks.some(t => t.status === 'todo');
  $: if (todayTasks.length < TODAY_WIP_LIMIT && limitWarning) {
    limitWarning = '';
  }

  $: doneTodayCount = tasks.filter(t => t.plannedDate === activeDate && t.status === 'done').length;
  $: totalMinutes = todayTasks.reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0);
  $: totalLabel = totalMinutes >= 60
    ? `${Math.floor(totalMinutes / 60)}h${totalMinutes % 60 > 0 ? ' ' + totalMinutes % 60 + 'min' : ''}`
    : totalMinutes > 0 ? `${totalMinutes} min` : '';
  $: scheduledTodayTasks = todayTasks
    .filter(t => !!t.scheduledStart)
    .sort((a, b) => (a.scheduledStart ?? '').localeCompare(b.scheduledStart ?? ''));
  $: unscheduledTodayTasks = todayTasks.filter(t => !t.scheduledStart);
  $: scheduledCount = scheduledTodayTasks.length;
  $: unscheduledCount = unscheduledTodayTasks.length;
  $: blockedMinutes = todayBlocks.reduce((sum, block) => {
    const start = new Date(block.start).getTime();
    const end = new Date(block.end).getTime();
    return sum + Math.max(0, Math.round((end - start) / 60_000));
  }, 0);
  $: terminMinutes = termine
    .filter((termin) => termin.date === activeDate)
    .reduce((sum, termin) => sum + termin.durationMinutes, 0);
  $: planningWindowMinutes = 9 * 60;
  $: availableTaskCapacityMinutes = Math.max(0, planningWindowMinutes - terminMinutes);
  $: workloadDeltaMinutes = availableTaskCapacityMinutes - totalMinutes;
  $: workloadLabel = Math.abs(workloadDeltaMinutes) >= 60
    ? `${Math.floor(Math.abs(workloadDeltaMinutes) / 60)}h${Math.abs(workloadDeltaMinutes) % 60 > 0 ? ' ' + Math.abs(workloadDeltaMinutes) % 60 + 'min' : ''}`
    : `${Math.abs(workloadDeltaMinutes)} min`;
  $: reservedCapacityMinutes = planningWindowMinutes - (blockedMinutes + terminMinutes);
  $: reservedCapacityLabel = Math.abs(reservedCapacityMinutes) >= 60
    ? `${Math.floor(Math.abs(reservedCapacityMinutes) / 60)}h${Math.abs(reservedCapacityMinutes) % 60 > 0 ? ' ' + Math.abs(reservedCapacityMinutes) % 60 + 'min' : ''}`
    : `${Math.abs(reservedCapacityMinutes)} min`;
  $: blockedLabel = blockedMinutes >= 60
    ? `${Math.floor(blockedMinutes / 60)}h${blockedMinutes % 60 > 0 ? ' ' + blockedMinutes % 60 + 'min' : ''}`
    : blockedMinutes > 0 ? `${blockedMinutes} min` : '0 min';
  $: terminLabel = terminMinutes >= 60
    ? `${Math.floor(terminMinutes / 60)}h${terminMinutes % 60 > 0 ? ' ' + terminMinutes % 60 + 'min' : ''}`
    : terminMinutes > 0 ? `${terminMinutes} min` : '0 min';
  $: loadPercent = availableTaskCapacityMinutes > 0
    ? Math.max(0, Math.min(100, Math.round((totalMinutes / availableTaskCapacityMinutes) * 100)))
    : 0;
  $: loadTrackClass = workloadDeltaMinutes < 0
    ? 'bg-red-500'
    : workloadDeltaMinutes <= 60
      ? 'bg-amber-500'
      : 'bg-green-500';
  $: completionStatus = todayTasks.length === 0
    ? 'leer'
    : unscheduledCount > 0
      ? 'slots-offen'
      : workloadDeltaMinutes < 0
        ? 'ueberplant'
        : mitIds.length === 0
          ? 'priorisieren'
          : 'bereit';
  $: planningState = todayTasks.length === 0
    ? 'leer'
    : unscheduledCount === 0
      ? 'komplett'
      : scheduledCount === 0
        ? 'offen'
        : 'teilweise';

  function projectColor(task: Task): string | null {
    if (!task.projectId) return null;
    return projects.find(p => p.id === task.projectId)?.color ?? null;
  }

  function isPoolGroupCollapsed(groupId: string): boolean {
    return collapsedPoolGroups.includes(groupId);
  }

  function togglePoolGroup(groupId: string): void {
    collapsedPoolGroups = isPoolGroupCollapsed(groupId)
      ? collapsedPoolGroups.filter(id => id !== groupId)
      : [...collapsedPoolGroups, groupId];
  }

  function canAssignMoreToToday(): boolean {
    return todayTasks.length < TODAY_WIP_LIMIT;
  }

  function showTodayLimitWarning(): void {
    limitWarning = `Heute ist bei ${todayTasks.length}/${TODAY_WIP_LIMIT}. Erst etwas abschließen oder umplanen.`;
  }

  // ── Task creation ──────────────────────────────────────────────────────────
  let newTitle = '';
  let newDuration = 30;
  let newProjectId = '';
  let addToToday = true;
  let inputEl: HTMLInputElement;

  function handleAdd(e: Event) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const task = addTask(newTitle.trim(), newDuration, [], newProjectId || undefined);
    if (!addToToday) {
      updateTask(task.id, { plannedDate: null });
    } else if (!canAssignMoreToToday()) {
      updateTask(task.id, { plannedDate: null });
      showTodayLimitWarning();
    } else {
      limitWarning = '';
    }
    newTitle = '';
    newDuration = 30;
    inputEl?.focus();
  }

  function assignToToday(task: Task) {
    if (task.plannedDate === activeDate) return true;
    if (!canAssignMoreToToday()) {
      showTodayLimitWarning();
      return false;
    }
    updateTask(task.id, { plannedDate: activeDate });
    limitWarning = '';
    return true;
  }

  function removeFromToday(task: Task) {
    removeBlockForTask(task.id);
    updateTask(task.id, { plannedDate: null, scheduledStart: null, scheduledEnd: null });
    if (todayTasks.length - 1 < TODAY_WIP_LIMIT) limitWarning = '';
  }

  function createDateTime(time: string): Date {
    return new Date(`${activeDate}T${time}:00`);
  }

  function formatScheduledTime(value: string | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }

  function scheduleTask(task: Task, start: Date): void {
    const scheduledStart = start.toISOString();
    updateTask(task.id, {
      plannedDate: activeDate,
      scheduledStart,
      scheduledEnd: null,
    });
    dropTaskOnCalendar({ ...task, plannedDate: activeDate }, start);
  }

  function quickSchedule(task: Task, time: string): void {
    scheduleTask(task, createDateTime(time));
  }

  function unscheduleTask(task: Task): void {
    removeBlockForTask(task.id);
    updateTask(task.id, {
      scheduledStart: null,
      scheduledEnd: null,
    });
  }

  function autoPlanTask(task: Task): void {
    const busySlots = getBusySlots();
    const [planned] = autoScheduleTasks([{ ...task, scheduledStart: null }], busySlots, 9, 18);
    if (planned?.scheduledStart) {
      scheduleTask(task, new Date(planned.scheduledStart));
    }
  }

  function getBusySlots() {
    return [
      ...todayBlocks.map((block) => ({ start: new Date(block.start), end: new Date(block.end) })),
      ...termine
        .filter((termin) => termin.date === activeDate)
        .map((termin) => {
          const start = createDateTime(termin.startTime);
          const end = new Date(start.getTime() + termin.durationMinutes * 60_000);
          return { start, end };
        }),
    ];
  }

  function autoPlanRemainingTasks(): void {
    if (unscheduledTodayTasks.length === 0) return;
    const busySlots = getBusySlots();
    const planned = autoScheduleTasks(
      unscheduledTodayTasks.map((task) => ({ ...task, scheduledStart: null })),
      busySlots,
      9,
      18,
    );
    for (const task of planned) {
      if (task.scheduledStart) {
        scheduleTask(task, new Date(task.scheduledStart));
      }
    }
  }

  // ── Duration inline edit ──────────────────────────────────────────────────
  let editDurationId: string | null = null;
  function commitDuration(task: Task, val: string) {
    const n = parseInt(val, 10);
    if (!isNaN(n) && n > 0) updateTask(task.id, { estimatedMinutes: n });
    editDurationId = null;
  }

  // ── Drag-to-reorder + Pool→Heute ──────────────────────────────────────────
  let draggingId: string | null = null;
  let dragSource: 'today' | 'pool' | null = null;
  let dragOverId: string | null = null;
  let todayDropActive = false;

  function onDragStartToday(e: DragEvent, id: string) {
    draggingId = id; dragSource = 'today';
    if (!e.dataTransfer) return;
    setTaskDragData(e.dataTransfer, id);
  }
  function onDragStartPool(e: DragEvent, id: string) {
    draggingId = id; dragSource = 'pool';
    if (!e.dataTransfer) return;
    setTaskDragData(e.dataTransfer, id);
  }
  function onDragOverToday(e: DragEvent, id: string) {
    e.preventDefault();
    dragOverId = id;
    todayDropActive = true;
  }
  function onDragOverTodayZone(e: DragEvent) {
    e.preventDefault();
    todayDropActive = true;
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    todayDropActive = false;
    const droppedTaskId = getTaskDragData(e.dataTransfer) || draggingId;
    if (droppedTaskId) draggingId = droppedTaskId;
    if (!draggingId) { draggingId = null; dragOverId = null; dragSource = null; return; }
    if (dragSource === 'pool') {
      const draggedTask = tasks.find(t => t.id === draggingId);
      if (draggedTask) assignToToday(draggedTask);
      draggingId = null; dragOverId = null; dragSource = null; return;
    }
    if (!dragOverId || draggingId === dragOverId) {
      draggingId = null; dragOverId = null; dragSource = null; return;
    }
    const ids = todayTasks.map(t => t.id);
    const from = ids.indexOf(draggingId);
    const to = ids.indexOf(dragOverId);
    if (from === -1 || to === -1) { draggingId = null; dragOverId = null; dragSource = null; return; }
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, draggingId!);
    reorderTasks(next);
    draggingId = null; dragOverId = null; dragSource = null;
  }
  function onDragEnd() { draggingId = null; dragOverId = null; dragSource = null; todayDropActive = false; }

  function startDay() {
    (document.querySelector('[data-nav="today"]') as HTMLElement)?.click();
  }

</script>

<!--
  Tagesplanung = "Werkzeug", nicht "Seite"
  Dichte Panels, sichtbare Controls, bg-bg Untergrund
-->
<div class="flex flex-col h-full overflow-hidden bg-bg">

  <!-- Tool-Header: kompakt, funktional -->
  <div class="flex items-center gap-3 px-4 py-0 border-b border-border bg-surface flex-shrink-0" style="min-height:44px">
    <div class="w-1 h-5 rounded-full bg-accent flex-shrink-0"></div>
    <span class="text-[13px] font-bold text-primary whitespace-nowrap">Plane deinen Tag</span>
    <span class="text-[11px] text-muted hidden sm:inline whitespace-nowrap">· {formatDate(activeDate)}</span>
    <div class="w-px h-4 bg-border flex-shrink-0 mx-1"></div>
    <input
      class="flex-1 text-[12px] text-secondary bg-transparent outline-none placeholder:text-muted/40 min-w-0"
      placeholder="Intention für heute…"
      value={intention}
      on:input={e => setIntention(e.currentTarget.value)}
    />
    <div class="flex items-center gap-2 flex-shrink-0">
      {#if doneTodayCount > 0}
        <span class="text-[11px] text-muted">{doneTodayCount} erledigt</span>
      {/if}
      <button
        on:click={startDay}
        class="px-3 py-1 bg-accent text-white rounded-md text-[12px] font-semibold hover:bg-accent/90 transition-colors"
      >Tag starten →</button>
    </div>
  </div>

  <div class="px-4 py-2 border-b border-border bg-surface/80 flex items-center gap-2 flex-wrap text-[11px]">
    <span class="px-2 py-1 rounded-full border border-border bg-bg text-secondary">
      Heute: {todayTasks.length} Tasks
    </span>
    <span class="px-2 py-1 rounded-full border border-border bg-bg text-secondary">
      Terminiert: {scheduledCount}
    </span>
    <span class="px-2 py-1 rounded-full border border-border bg-bg text-secondary">
      Offen: {unscheduledCount}
    </span>
    <span class="px-2 py-1 rounded-full border border-border bg-bg text-secondary">
      Slots: {blockedLabel}
    </span>
    <span class="px-2 py-1 rounded-full border border-border bg-bg text-secondary">
      Termine: {terminLabel}
    </span>
    <span class="px-2 py-1 rounded-full border {workloadDeltaMinutes < 0 ? 'border-red-200 bg-red-50 text-red-700' : workloadDeltaMinutes <= 60 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-border bg-bg text-secondary'}">
      {workloadDeltaMinutes < 0 ? `Tasklast zu hoch: ${workloadLabel}` : `Task-Puffer: ${workloadLabel}`}
    </span>
    <span class="px-2 py-1 rounded-full border {reservedCapacityMinutes < 0 ? 'border-red-200 bg-red-50 text-red-700' : reservedCapacityMinutes <= 60 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-border bg-bg text-secondary'}">
      {reservedCapacityMinutes < 0 ? `Kalender überzogen: ${reservedCapacityLabel}` : `Kalender frei: ${reservedCapacityLabel}`}
    </span>
    <span class="px-2 py-1 rounded-full border {completionStatus === 'bereit' ? 'border-green-200 bg-green-50 text-green-700' : completionStatus === 'ueberplant' ? 'border-red-200 bg-red-50 text-red-700' : completionStatus === 'priorisieren' || planningState === 'teilweise' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-border bg-bg text-muted'}">
      {completionStatus === 'leer'
        ? 'Noch nichts geplant'
        : completionStatus === 'slots-offen'
          ? 'Slots fehlen noch'
          : completionStatus === 'ueberplant'
            ? 'Plan überzieht'
            : completionStatus === 'priorisieren'
              ? 'Top 3 noch offen'
              : 'Tagesplan bereit'}
    </span>
    {#if unscheduledCount > 0}
      <button
        class="ml-auto px-2.5 py-1 rounded-md bg-accent text-white font-semibold hover:bg-accent/90 transition-colors"
        on:click={autoPlanRemainingTasks}
      >Rest automatisch einplanen</button>
    {/if}
  </div>

  <!-- 3 columns on bg-bg -->
  <div class="flex-1 grid overflow-hidden min-w-0 gap-px bg-border" style="grid-template-columns: 260px 1fr 280px">

    <!-- ── Pool ── -->
    <div class="flex flex-col overflow-hidden bg-surface">
      <!-- Pool header + Task Creation -->
      <div class="border-b border-border flex-shrink-0">
        <!-- Header -->
        <div class="flex items-center justify-between px-3 pt-2.5 pb-1">
          <span class="text-[10px] font-bold uppercase tracking-[0.09em] text-muted">
            {showRecurringManager ? 'Wiederholt' : 'Aufgaben-Pool'}
            {#if !showRecurringManager && poolTasks.length > 0}
              <span class="font-normal normal-case tracking-normal text-secondary ml-1">{poolTasks.length}</span>
            {/if}
          </span>
          <div class="flex items-center gap-2">
            {#if !showRecurringManager}
              <select
                bind:value={poolSort}
                class="text-[10px] text-muted border border-border rounded-md px-1.5 py-0.5 bg-surface outline-none max-w-[110px]"
                title="Pool sortieren"
              >
                <option value="date">Nach Datum</option>
                <option value="project">Nach Projekt</option>
                <option value="manual">Manuell</option>
              </select>
            {/if}
            {#if !showRecurringManager && focusProjectIds.length > 0}
              <button
                class="text-[10px] transition-colors {showAllProjects ? 'text-accent font-semibold' : 'text-muted hover:text-secondary'}"
                on:click={() => showAllProjects = !showAllProjects}
                title={showAllProjects ? 'Nur Fokus-Projekte anzeigen' : 'Alle Projekte anzeigen'}
              >{showAllProjects ? 'Alle ✓' : 'Alle'}</button>
            {/if}
            <button
              class="text-[11px] transition-colors px-1.5 py-0.5 rounded {showRecurringManager ? 'text-accent bg-accent-subtle' : 'text-muted hover:text-secondary'}"
              on:click={() => showRecurringManager = !showRecurringManager}
              title="Wiederkehrende Aufgaben verwalten"
            >↺{#if recurringDueToday.length > 0 && !showRecurringManager}<span class="ml-0.5 font-semibold text-accent">{recurringDueToday.length}</span>{/if}</button>
          </div>
        </div>

        <!-- Task Creation: prominenter Flow -->
        <form on:submit={handleAdd} class="px-3 pb-3 flex flex-col gap-2">
          <!-- svelte-ignore a11y-autofocus -->
          <input
            bind:this={inputEl}
            bind:value={newTitle}
            class="w-full px-3 py-2 border-2 border-border rounded-lg text-[13px] bg-surface outline-none focus:border-accent placeholder:text-muted/50 transition-colors"
            placeholder="Neue Aufgabe erstellen…"
          />
          <div class="flex items-center gap-1.5">
            <select bind:value={newDuration} class="border border-border rounded-md px-2 py-1.5 text-[12px] bg-surface outline-none">
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>1 h</option>
              <option value={90}>1,5 h</option>
              <option value={120}>2 h</option>
            </select>
            {#if activeProjects.length > 0}
              <select bind:value={newProjectId} class="border border-border rounded-md px-2 py-1.5 text-[12px] bg-surface outline-none flex-1 min-w-0">
                <option value="">Kein Projekt</option>
                {#each activeProjects as p (p.id)}
                  <option value={p.id}>{p.name}</option>
                {/each}
              </select>
            {/if}
            <label class="flex items-center gap-1 text-[11px] text-muted cursor-pointer whitespace-nowrap ml-auto">
              <input type="checkbox" bind:checked={addToToday} class="w-3 h-3" />
              Heute
            </label>
            <button
              type="submit"
              class="px-3 py-1.5 bg-accent text-white rounded-md text-[12px] font-semibold hover:bg-accent/90 transition-colors whitespace-nowrap"
            >Hinzufügen</button>
          </div>
        </form>
      </div>

      <!-- Pool list / Recurring manager -->
      <div class="flex-1 overflow-y-auto">

        {#if showRecurringManager}
          <div class="px-3 py-2">
            <RecurringTasksPanel />
          </div>
        {:else}

        <!-- Recurring tasks due today -->
        {#if recurringDueToday.length > 0}
          <div class="border-b border-border/60">
            <div class="px-3 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-[0.07em] text-accent/70">↺ Heute fällig</div>
            {#each recurringDueToday as task (task.id)}
              {@const col = projectColor(task)}
              <div class="flex items-center gap-2 px-3 py-2 border-b border-border/40 hover:bg-bg/80 group select-none">
                <span class="text-accent/60 text-[11px] flex-shrink-0">↺</span>
                {#if col}
                  <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background:{col}" />
                {/if}
                <span class="text-[12px] text-secondary flex-1 min-w-0 truncate">{task.title}</span>
                <span class="text-[10px] text-muted flex-shrink-0">{(task.estimatedMinutes ?? 0) < 60 ? (task.estimatedMinutes ?? 0) + 'min' : ((task.estimatedMinutes ?? 0) / 60) + 'h'}</span>
                <button
                  on:click={() => assignRecurringToToday(task.id)}
                  class="text-[11px] text-accent flex-shrink-0 whitespace-nowrap hover:underline font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                >→</button>
              </div>
            {/each}
          </div>
        {/if}

        {#each poolGroups as group (group.id)}
          <section class="border-b border-border/50">
            <button
              class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bg/50 transition-colors"
              on:click={() => togglePoolGroup(group.id)}
              title={isPoolGroupCollapsed(group.id) ? 'Gruppe ausklappen' : 'Gruppe einklappen'}
            >
              <span class="text-[10px] text-muted flex-shrink-0">{isPoolGroupCollapsed(group.id) ? '▸' : '▾'}</span>
              {#if group.color}
                <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background:{group.color}" />
              {/if}
              <span class="text-[10px] font-bold uppercase tracking-[0.07em] text-muted flex-1 truncate">{group.label}</span>
              <span class="text-[10px] text-muted bg-bg px-1.5 py-0.5 rounded-md">{group.tasks.length}</span>
            </button>

            {#if !isPoolGroupCollapsed(group.id)}
              {#each group.tasks as task (task.id)}
                {@const col = projectColor(task)}
                {@const age = daysSince(task.updatedAt)}
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <div
                  class="flex items-center gap-2 px-3 py-2 border-t border-border/40 hover:bg-bg/80 group cursor-grab select-none
                    {draggingId === task.id ? 'opacity-30' : ''}"
                  draggable="true"
                  on:dragstart={e => onDragStartPool(e, task.id)}
                  on:dragend={onDragEnd}
                >
                  <span class="text-muted/50 text-[11px] flex-shrink-0">⠿</span>
                  {#if col}
                    <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background:{col}" />
                  {/if}
                  <span class="text-[12px] text-secondary flex-1 min-w-0 truncate">{task.title}</span>
                  <div class="flex items-center gap-2 text-[10px] text-muted flex-shrink-0 whitespace-nowrap">
                    <span>⏱ {(task.estimatedMinutes ?? 0) < 60 ? (task.estimatedMinutes ?? 0) + 'min' : ((task.estimatedMinutes ?? 0) / 60) + 'h'}</span>
                    {#if age != null && age >= 7}
                      <span title={`Seit ${age} Tagen unbearbeitet`}>⌛ {age}d</span>
                    {/if}
                  </div>
                  <button
                    on:click={() => assignToToday(task)}
                    class="text-[11px] text-accent flex-shrink-0 whitespace-nowrap hover:underline font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                  >→</button>
                </div>
              {/each}
            {/if}
          </section>
        {:else}
          {#if hasAnyTodoTasks}
            <p class="text-[11px] text-muted px-3 py-3">Alle Aufgaben sind bereits für heute eingeplant.</p>
          {:else}
            <div class="px-3 py-4 flex flex-col gap-2">
              <p class="text-[12px] text-muted">Noch keine Aufgaben vorhanden.</p>
              <p class="text-[11px] text-muted/70">Erstelle deine erste Aufgabe oben.</p>
            </div>
          {/if}
        {/each}

        {/if}<!-- end showRecurringManager -->
      </div>
    </div>

    <!-- ── Heute ── -->
    <div class="flex flex-col overflow-hidden bg-surface">
      <!-- Heute header / toolbar -->
      <div class="px-3 pt-3 pb-2 border-b border-border flex-shrink-0 bg-bg/60">
        <div class="flex items-center gap-3">
          <span class="text-[10px] font-bold uppercase tracking-[0.09em] {todayTasks.length > TODAY_WIP_LIMIT ? 'text-red-600' : 'text-muted'}">
            Heute
            <span class="font-normal normal-case tracking-normal ml-1 {todayTasks.length >= TODAY_WIP_LIMIT ? 'text-red-600' : 'text-accent'}">{todayTasks.length}/{TODAY_WIP_LIMIT}</span>
          </span>
          {#if totalLabel}
            <span class="text-[11px] text-muted">· {totalLabel}</span>
          {/if}
          {#if todayTasks.length > 0}
            <span class="text-[11px] text-muted">· {scheduledCount} terminiert</span>
          {/if}
          <span class="text-[11px] text-muted ml-auto">★ {mitIds.length}/3</span>
        </div>
        <p class="text-[11px] text-muted mt-0.5">
          {#if todayTasks.length === 0}
            Ziehe Aufgaben aus dem Pool hierher oder erstelle neue.
          {:else if todayTasks.length >= TODAY_WIP_LIMIT}
            WIP-Limit erreicht. Erst abschließen oder umplanen, bevor neue Tasks dazukommen.
          {:else if mitIds.length === 0}
            Markiere bis zu 3 Aufgaben mit ★ als Top-Priorität.
          {:else}
            Von hier aus priorisieren, dann per Drag oder Schnellaktion in den Kalender terminieren.
          {/if}
        </p>
        {#if todayTasks.length > 0}
          <div class="mt-2 rounded-lg border border-border/70 bg-surface px-2.5 py-2">
            <div class="flex items-center justify-between gap-2 text-[11px] text-muted">
              <span>Kapazität für Aufgaben</span>
              <span>{totalLabel || '0 min'} / {availableTaskCapacityMinutes >= 60 ? `${Math.floor(availableTaskCapacityMinutes / 60)}h${availableTaskCapacityMinutes % 60 > 0 ? ' ' + availableTaskCapacityMinutes % 60 + 'min' : ''}` : `${availableTaskCapacityMinutes} min`}</span>
            </div>
            <div class="mt-2 h-2 overflow-hidden rounded-full bg-bg">
              <div class="h-full rounded-full transition-[width] duration-300 {loadTrackClass}" style="width:{loadPercent}%" />
            </div>
            <div class="mt-2 text-[11px] {workloadDeltaMinutes < 0 ? 'text-red-700' : workloadDeltaMinutes <= 60 ? 'text-amber-800' : 'text-muted'}">
              {#if workloadDeltaMinutes < 0}
                Die heutige Aufgabenlast liegt {workloadLabel} über der verfügbaren Zeit nach Terminen.
              {:else if workloadDeltaMinutes <= 60}
                Der Plan ist knapp. Es bleiben nur noch {workloadLabel} Puffer für Aufgaben.
              {:else}
                Es bleiben noch {workloadLabel} Puffer für Aufgaben zusätzlich zu den gesetzten Slots.
              {/if}
            </div>
          </div>
        {/if}
        {#if unscheduledCount > 0}
          <div class="mt-2 flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
            <span>{unscheduledCount} Task{unscheduledCount === 1 ? '' : 's'} sind fuer heute entschieden, aber noch ohne Zeitslot.</span>
            <button
              class="font-semibold text-amber-800 hover:text-amber-950 whitespace-nowrap"
              on:click={autoPlanRemainingTasks}
            >Auto-Plan</button>
          </div>
        {/if}
        {#if limitWarning}
          <div class="mt-2 px-2.5 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
            {limitWarning}
          </div>
        {/if}
        {#if planningState === 'komplett'}
          <div class="mt-2 flex items-center justify-between gap-2 rounded-lg border border-green-200 bg-green-50 px-2.5 py-2 text-[11px] text-green-900">
            <span>
              {#if completionStatus === 'ueberplant'}
                Alle Tasks haben Slots, aber der Plan ist zeitlich zu voll. Verschiebe oder kürze etwas.
              {:else if completionStatus === 'priorisieren'}
                Alle Tasks haben Slots. Für einen wirklich sauberen Tagesabschluss fehlen nur noch die Top 3.
              {:else}
                Der Tag ist sauber vorbereitet: alle Tasks terminiert, Kapazität plausibel, Fokus gesetzt.
              {/if}
            </span>
            <button
              class="font-semibold text-green-800 hover:text-green-950 whitespace-nowrap"
              on:click={startDay}
            >Zum Tagesfokus</button>
          </div>
        {/if}
      </div>

      <!-- Task rows + drop zone -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div
        class="flex-1 overflow-y-auto transition-colors {todayDropActive && dragSource === 'pool' ? (todayTasks.length >= TODAY_WIP_LIMIT ? 'bg-red-50' : 'bg-accent-subtle/30') : ''}"
        on:dragover={onDragOverTodayZone}
        on:drop={onDrop}
        on:dragleave={() => { todayDropActive = false; }}
      >
        {#if unscheduledTodayTasks.length > 0}
          <div class="px-3 py-2 border-b border-border/60 bg-bg/50">
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold uppercase tracking-[0.07em] text-muted">Noch einplanen</span>
              <span class="text-[10px] text-muted bg-surface px-1.5 py-0.5 rounded-md">{unscheduledCount}</span>
            </div>
            <p class="text-[11px] text-muted mt-1">Diese Tasks sind fuer heute entschieden, haben aber noch keinen Zeitslot.</p>
          </div>
        {/if}

        {#each unscheduledTodayTasks as task, _i (task.id)}
          {@const isMit = mitIds.includes(task.id)}
          {@const col = projectColor(task)}
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div
            class="flex items-center gap-2 px-3 py-[9px] border-b border-border/60 cursor-grab select-none
              {isMit ? 'bg-accent-subtle border-l-[3px] border-l-accent' : 'hover:bg-bg/60'}
              {draggingId === task.id && dragSource === 'today' ? 'opacity-30' : ''}
              {dragOverId === task.id && dragSource === 'today' ? 'border-t-2 border-t-accent' : ''}"
            draggable="true"
            on:dragstart={e => onDragStartToday(e, task.id)}
            on:dragover={e => onDragOverToday(e, task.id)}
            on:drop={onDrop}
            on:dragend={onDragEnd}
          >
            <!-- Drag handle -->
            <span class="text-muted/60 text-[11px] flex-shrink-0 cursor-grab hover:text-muted transition-colors">⠿</span>

            <!-- MIT star -->
            <button
              on:click={() => toggleMit(task.id)}
              class="text-[13px] flex-shrink-0 transition-colors leading-none
                {isMit ? 'text-amber-400' : 'text-border-strong hover:text-amber-400'}"
              disabled={!isMit && mitIds.length >= 3}
              title={isMit ? 'Aus Top 3 entfernen' : mitIds.length < 3 ? 'Als Top 3 markieren' : '3 bereits gewählt'}
            >★</button>

            {#if col}
              <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background:{col}" />
            {/if}

            <span class="text-[13px] flex-1 min-w-0 truncate {isMit ? 'font-semibold text-primary' : 'text-primary'}">
              {task.title}
            </span>

            <!-- Duration: click to edit -->
            {#if editDurationId === task.id}
              <!-- svelte-ignore a11y-autofocus -->
              <input
                type="number"
                class="w-12 px-1 py-0.5 border border-accent rounded text-[11px] text-center outline-none bg-surface"
                value={task.estimatedMinutes ?? 30}
                min="5" step="5" autofocus
                on:blur={e => commitDuration(task, e.currentTarget.value)}
                on:keydown={e => { if (e.key === 'Enter') commitDuration(task, e.currentTarget.value); if (e.key === 'Escape') editDurationId = null; }}
              />
              <span class="text-[10px] text-muted">min</span>
            {:else}
              <button
                class="text-[11px] text-muted hover:text-accent flex-shrink-0 tabular-nums min-w-[32px] text-right"
                on:click={() => editDurationId = task.id}
                title="Dauer ändern"
              >{(task.estimatedMinutes ?? 0) < 60 ? (task.estimatedMinutes ?? 0) + 'm' : ((task.estimatedMinutes ?? 0) / 60) + 'h'}</button>
            {/if}

            <div class="flex items-center gap-1 flex-shrink-0">
              <button
                class="px-1.5 py-0.5 rounded text-[10px] text-accent hover:bg-accent-subtle"
                on:click={() => autoPlanTask(task)}
                title="Naechsten freien Slot finden"
              >Auto</button>
              <button
                class="px-1.5 py-0.5 rounded text-[10px] text-muted hover:bg-bg hover:text-accent"
                on:click={() => quickSchedule(task, '09:00')}
                title="Um 09:00 einplanen"
              >09</button>
              <button
                class="px-1.5 py-0.5 rounded text-[10px] text-muted hover:bg-bg hover:text-accent"
                on:click={() => quickSchedule(task, '13:00')}
                title="Um 13:00 einplanen"
              >13</button>
            </div>

            <!-- Remove -->
            <button
              on:click={() => removeFromToday(task)}
              class="w-5 h-5 flex items-center justify-center rounded text-muted/50 hover:text-secondary hover:bg-bg transition-colors flex-shrink-0 text-[11px]"
              title="Aus Heute entfernen"
            >✕</button>
          </div>
        {/each}

        {#if scheduledTodayTasks.length > 0}
          <div class="px-3 py-2 border-b border-border/60 bg-accent-subtle/30">
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold uppercase tracking-[0.07em] text-accent">Terminiert</span>
              <span class="text-[10px] text-accent bg-surface px-1.5 py-0.5 rounded-md">{scheduledCount}</span>
            </div>
            <p class="text-[11px] text-muted mt-1">Diese Tasks haben bereits einen Slot im Kalender und koennen dort per Drag verschoben werden.</p>
          </div>
        {/if}

        {#each scheduledTodayTasks as task, _i (task.id)}
          {@const isMit = mitIds.includes(task.id)}
          {@const col = projectColor(task)}
          <div
            class="flex items-center gap-2 px-3 py-[9px] border-b border-border/60 cursor-grab select-none bg-accent-subtle/10
              {draggingId === task.id && dragSource === 'today' ? 'opacity-30' : ''}"
            draggable="true"
            on:dragstart={e => onDragStartToday(e, task.id)}
            on:dragend={onDragEnd}
          >
            <span class="text-muted/60 text-[11px] flex-shrink-0 cursor-grab">⠿</span>
            <button
              on:click={() => toggleMit(task.id)}
              class="text-[13px] flex-shrink-0 transition-colors leading-none
                {isMit ? 'text-amber-400' : 'text-border-strong hover:text-amber-400'}"
              disabled={!isMit && mitIds.length >= 3}
              title={isMit ? 'Aus Top 3 entfernen' : mitIds.length < 3 ? 'Als Top 3 markieren' : '3 bereits gewählt'}
            >★</button>
            {#if col}
              <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background:{col}" />
            {/if}
            <span class="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-surface text-accent flex-shrink-0">
              {formatScheduledTime(task.scheduledStart)}
            </span>
            <span class="text-[13px] flex-1 min-w-0 truncate {isMit ? 'font-semibold text-primary' : 'text-primary'}">
              {task.title}
            </span>
            <span class="text-[11px] text-muted flex-shrink-0 tabular-nums min-w-[32px] text-right">
              {(task.estimatedMinutes ?? 0) < 60 ? (task.estimatedMinutes ?? 0) + 'm' : ((task.estimatedMinutes ?? 0) / 60) + 'h'}
            </span>
            <button
              on:click={() => unscheduleTask(task)}
              class="px-1.5 py-0.5 rounded text-[10px] text-muted hover:bg-bg hover:text-accent flex-shrink-0"
              title="Zeitslot loesen"
            >Zeit lösen</button>
            <button
              on:click={() => removeFromToday(task)}
              class="w-5 h-5 flex items-center justify-center rounded text-muted/50 hover:text-secondary hover:bg-bg transition-colors flex-shrink-0 text-[11px]"
              title="Aus Heute entfernen"
            >✕</button>
          </div>
        {/each}

        {#if todayTasks.length === 0}
          <div class="px-4 py-8 text-center">
            <p class="text-[13px] font-medium text-secondary mb-1">Noch leer</p>
            <p class="text-[11px] text-muted leading-relaxed">
              Klicke „→" neben einer Aufgabe im Pool<br/>oder erstelle direkt eine neue.
            </p>
          </div>
        {/if}
      </div>
    </div>

    <!-- ── Kalender ── -->
    <CalendarView planningMode={true} {activeDate} />

  </div>
</div>
