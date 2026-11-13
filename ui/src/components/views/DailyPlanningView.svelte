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
  import { $mitTaskIds as mitStore, toggleMit } from '../../stores/planningStore';
  import { $currentWeekPlan as currentWeekPlanStore } from '../../stores/weekPlanStore';
  import { daysSince, formatHm, isRecurringDueOn } from '../../domain/dateUtils';
  import { autoScheduleTasks } from '../../domain/taskService';
  import { toast } from '../../stores/toastStore';
  import CalendarView from './CalendarView.svelte';
  import RecurringTasksPanel from '../widgets/RecurringTasksPanel.svelte';
  import type { Task } from '../../domain/types';
  import { getTaskDragData, setTaskDragData } from '../../lib/taskDrag';
  import { taskCapacityMinutes } from '../../lib/dayStats';

  type PoolFilter = 'focus' | 'all' | 'recurring';

  const POOL_PREFS_KEY = 'etasks:planning:pool-prefs';

  let tasks: Task[] = tasksStore.get();
  let activeDate: string = activeDateStore.get();
  let mitIds: string[] = mitStore.get();
  let todayBlocks = todayBlocksStore.get();
  let termine = termineStore.get();

  onDestroy(tasksStore.subscribe(v => { tasks = [...v]; }));
  onDestroy(activeDateStore.subscribe(v => { activeDate = v; }));
  onDestroy(mitStore.subscribe(v => { mitIds = [...v]; }));
  onDestroy(todayBlocksStore.subscribe(v => { todayBlocks = [...v]; }));
  onDestroy(termineStore.subscribe(v => { termine = [...v]; }));

  $: projects = $projectsStore;
  $: activeProjects = projects.filter(p => p.status === 'active');

  $: todayTasks = tasks
    .filter(t => t.plannedDate === activeDate && t.status === 'todo')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  $: focusProjectIds = $currentWeekPlanStore.focusProjectIds ?? [];
  // „Fokus-Projekte“ only makes sense when the week plan names focus projects
  const POOL_CHIPS: { id: PoolFilter; label: string }[] = [
    { id: 'focus', label: 'Fokus-Projekte' },
    { id: 'all', label: 'Alle' },
    { id: 'recurring', label: 'Wiederkehrend' },
  ];
  let poolFilterChoice: PoolFilter | null = null;
  $: poolFilter = poolFilterChoice ?? (focusProjectIds.length > 0 ? 'focus' : 'all');
  let collapsedPoolGroups: string[] = [];
  let poolPrefsReady = false;

  onMount(() => {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = JSON.parse(localStorage.getItem(POOL_PREFS_KEY) ?? '{}');
      collapsedPoolGroups = Array.isArray(raw.collapsedPoolGroups) ? raw.collapsedPoolGroups : [];
    } catch {
      collapsedPoolGroups = [];
    }
    poolPrefsReady = true;
  });

  $: if (poolPrefsReady && typeof localStorage !== 'undefined') {
    localStorage.setItem(POOL_PREFS_KEY, JSON.stringify({ collapsedPoolGroups }));
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

  // Pool is grouped by project (named projects alphabetically, „Ohne Projekt“ last)
  function comparePoolTasks(a: Task, b: Task): number {
    const name = (t: Task) => (t.projectId ? (projects.find(p => p.id === t.projectId)?.name ?? '') : '');
    const aName = name(a);
    const bName = name(b);
    if (!aName !== !bName) return aName ? -1 : 1;
    const byProject = aName.localeCompare(bName, 'de');
    if (byProject !== 0) return byProject;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  }

  $: poolTasksAll = tasks
    .filter(t => t.status === 'todo' && !t.recurrence && t.plannedDate !== activeDate)
    .sort(comparePoolTasks);

  $: poolTasks = poolFilter === 'focus' && focusProjectIds.length > 0
    ? poolTasksAll.filter(t => !t.projectId || focusProjectIds.includes(t.projectId))
    : poolTasksAll;

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

  $: totalMinutes = todayTasks.reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0);
  $: scheduledTodayTasks = todayTasks.filter(t => !!t.scheduledStart);
  $: unscheduledTodayTasks = todayTasks.filter(t => !t.scheduledStart);
  $: unscheduledCount = unscheduledTodayTasks.length;
  $: terminMinutes = termine
    .filter((termin) => termin.date === activeDate)
    .reduce((sum, termin) => sum + termin.durationMinutes, 0);
  $: capacityMinutes = taskCapacityMinutes(terminMinutes);
  $: bufferMinutes = capacityMinutes - totalMinutes;
  $: loadPercent = capacityMinutes > 0
    ? Math.max(0, Math.min(100, Math.round((totalMinutes / capacityMinutes) * 100)))
    : (totalMinutes > 0 ? 100 : 0);
  $: loadColor = bufferMinutes < 0 ? 'var(--et-danger)' : bufferMinutes <= 60 ? 'var(--et-warning)' : 'var(--et-success)';
  $: bufferColor = bufferMinutes < 0 ? 'var(--et-danger)' : bufferMinutes <= 60 ? 'var(--et-warning-text)' : 'var(--et-success-text)';

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

  // ── Task creation ──────────────────────────────────────────────────────────
  let newTitle = '';
  let newDuration = 30;
  let newProjectId = '';
  let addToToday = false;
  let showAddOptions = false;
  let inputEl: HTMLInputElement;

  function handleAdd(e: Event) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const task = addTask(newTitle.trim(), newDuration, [], newProjectId || undefined);
    if (!addToToday) updateTask(task.id, { plannedDate: null });
    newTitle = '';
    newDuration = 30;
    inputEl?.focus();
  }

  function assignToToday(task: Task) {
    if (task.plannedDate === activeDate) return true;
    if (task.scheduledStart) {
      // a block on another day no longer applies
      removeBlockForTask(task.id);
      updateTask(task.id, { plannedDate: activeDate, scheduledStart: null, scheduledEnd: null });
    } else {
      updateTask(task.id, { plannedDate: activeDate });
    }
    return true;
  }

  function removeFromToday(task: Task) {
    removeBlockForTask(task.id);
    updateTask(task.id, { plannedDate: null, scheduledStart: null, scheduledEnd: null, priorityRank: null });
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
    const [planned] = autoScheduleTasks([{ ...task, scheduledStart: null }], busySlots, 9, 18, { date: activeDate });
    if (planned?.scheduledStart) {
      scheduleTask(task, new Date(planned.scheduledStart));
    } else {
      toast('Kein freier Slot mehr bis 18:00 Uhr.', 'info');
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

  // Auto-plan first only proposes slots (dashed in list and calendar); „Übernehmen“ books them.
  let proposals: { taskId: string; title: string; start: string; minutes: number }[] = [];
  $: proposals = proposals.filter(p => unscheduledTodayTasks.some(t => t.id === p.taskId));
  let proposalDate = activeDate;
  $: if (activeDate !== proposalDate) { proposalDate = activeDate; proposals = []; }
  $: proposalFor = new Map(proposals.map(p => [p.taskId, p]));

  function proposeAutoPlan(): void {
    if (unscheduledTodayTasks.length === 0) return;
    const planned = autoScheduleTasks(
      unscheduledTodayTasks.map((task) => ({ ...task, scheduledStart: null })),
      getBusySlots(),
      9,
      18,
      { date: activeDate },
    );
    proposals = planned
      .filter((task) => task.scheduledStart)
      .map((task) => ({ taskId: task.id, title: task.title, start: task.scheduledStart!, minutes: task.estimatedMinutes ?? 30 }));
    const notFitting = planned.length - proposals.length;
    if (notFitting > 0) {
      toast(
        notFitting === 1
          ? '1 Aufgabe passt nicht mehr in den Tag und bleibt unverplant.'
          : `${notFitting} Aufgaben passen nicht mehr in den Tag und bleiben unverplant.`,
        'info',
      );
    }
    if (proposals.length === 0) toast('Kein freier Slot mehr bis 18:00 Uhr.', 'info');
  }

  function acceptProposals(): void {
    for (const p of proposals) {
      const task = todayTasks.find(t => t.id === p.taskId);
      if (task && !task.scheduledStart) scheduleTask(task, new Date(p.start));
    }
    proposals = [];
  }

  function discardProposals(): void {
    proposals = [];
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

</script>

<div class="flex-1 overflow-y-auto px-8 pb-7">
  <div class="flex flex-wrap gap-4 items-start">

    <!-- ── Pool ── -->
    <section aria-label="Aufgaben-Pool" class="flex-1 basis-[300px] max-w-[340px] min-w-0 flex flex-col rounded-[14px] border border-border bg-surface">
      <div class="flex items-center gap-2.5 px-4 pt-3.5 pb-2.5">
        <h2 class="flex-1 text-[15px] font-semibold">Pool</h2>
        <span class="text-[12px]" style="color:var(--et-text-3)">{poolFilter === 'recurring' ? `${recurringTemplates.length} Vorlagen` : `${poolTasks.length} offen`}</span>
      </div>
      <div class="flex gap-1.5 px-4 pb-3 flex-wrap" role="group" aria-label="Pool filtern">
        {#each POOL_CHIPS as chip (chip.id)}
          {@const on = poolFilter === chip.id}
          <button
            class="h-9 px-3 rounded-full text-[13px] font-medium transition-colors inline-flex items-center gap-1.5 {on ? 'text-white' : 'border border-[var(--et-border-strong)] bg-surface hover:bg-[var(--et-surface-sunken)]'}"
            style={on ? 'background:var(--et-inverse)' : 'color:var(--et-text-2)'}
            aria-pressed={on}
            on:click={() => poolFilterChoice = chip.id}
          >
            {chip.label}
            {#if chip.id === 'recurring' && recurringDueToday.length > 0}
              <span class="min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-semibold flex items-center justify-center" style="background:{on ? '#fff' : 'var(--et-accent-soft)'};color:var(--et-accent-strong)">{recurringDueToday.length}</span>
            {/if}
          </button>
        {/each}
      </div>

      <div class="max-h-[560px] overflow-y-auto">
        {#if recurringDueToday.length > 0}
          <div>
            <div class="px-4 py-2 border-t border-[var(--et-border-subtle)] text-[12px] font-semibold" style="background:var(--et-surface-sunken);color:var(--et-accent-strong)">Heute fällig (wiederkehrend)</div>
            {#each recurringDueToday as task (task.id)}
              {@const col = projectColor(task)}
              <div class="flex items-center gap-2.5 min-h-[44px] pl-4 pr-2 border-t border-[var(--et-border-subtle)]">
                {#if col}<span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{col}" aria-hidden="true"></span>{/if}
                <span class="flex-1 min-w-0 truncate">{task.title}</span>
                <span class="text-[12px] whitespace-nowrap" style="color:var(--et-text-3)">{formatHm(task.estimatedMinutes ?? 0)}</span>
                <button
                  class="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--et-accent-soft)]"
                  style="background:var(--et-accent-soft);color:var(--et-accent-strong)"
                  aria-label="{task.title} heute einplanen"
                  on:click={() => assignRecurringToToday(task.id)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>
                </button>
              </div>
            {/each}
          </div>
        {/if}

        {#if poolFilter === 'recurring'}
          <div class="px-4 py-3 border-t border-[var(--et-border-subtle)]">
            <RecurringTasksPanel />
          </div>
        {:else}
          {#each poolGroups as group (group.id)}
            <button
              class="w-full flex items-center gap-2 min-h-[36px] px-4 py-2 border-t border-[var(--et-border-subtle)] text-left text-[12px] font-semibold hover:bg-[var(--et-surface-sunken)] transition-colors"
              style="background:var(--et-surface-sunken);color:var(--et-text-2)"
              aria-expanded={!isPoolGroupCollapsed(group.id)}
              on:click={() => togglePoolGroup(group.id)}
            >
              <svg class="flex-shrink-0 transition-transform {isPoolGroupCollapsed(group.id) ? '-rotate-90' : ''}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>
              <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{group.color ?? 'var(--et-project-neutral)'}" aria-hidden="true"></span>
              <span class="flex-1 truncate">{group.label}</span>
              <span class="font-medium" style="color:var(--et-text-3)">{group.tasks.length}</span>
            </button>

            {#if !isPoolGroupCollapsed(group.id)}
              {#each group.tasks as task (task.id)}
                {@const age = daysSince(task.updatedAt)}
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <div
                  class="flex items-center gap-2.5 min-h-[44px] pl-4 pr-2 border-t border-[var(--et-border-subtle)] cursor-grab select-none {draggingId === task.id ? 'opacity-30' : ''}"
                  draggable="true"
                  on:dragstart={e => onDragStartPool(e, task.id)}
                  on:dragend={onDragEnd}
                >
                  <span class="flex-1 min-w-0 truncate">{task.title}</span>
                  {#if age != null && age >= 7}
                    <span class="text-[12px] font-semibold whitespace-nowrap" style="color:var(--et-warning-text)" title="Seit {age} Tagen unbearbeitet">seit {age} Tagen</span>
                  {/if}
                  <span class="text-[12px] whitespace-nowrap" style="color:var(--et-text-3)">{formatHm(task.estimatedMinutes ?? 0)}</span>
                  <button
                    class="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg transition-colors hover:brightness-95"
                    style="background:var(--et-accent-soft);color:var(--et-accent-strong)"
                    aria-label="{task.title} heute einplanen"
                    on:click={() => assignToToday(task)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>
                  </button>
                </div>
              {/each}
            {/if}
          {:else}
            <p class="px-4 py-4 border-t border-[var(--et-border-subtle)] text-[13px]" style="color:var(--et-text-3)">
              {#if hasAnyTodoTasks}
                {poolFilter === 'focus' ? 'Keine offenen Aufgaben in den Fokus-Projekten. Unter „Alle“ siehst du den ganzen Pool.' : 'Alle Aufgaben sind bereits für heute eingeplant.'}
              {:else}
                Noch keine Aufgaben vorhanden. Lege unten die erste an.
              {/if}
            </p>
          {/each}
        {/if}
      </div>

      <form on:submit={handleAdd} class="border-t border-border">
        <label class="flex items-center gap-2.5 min-h-[48px] px-4">
          <svg class="flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--et-text-3)" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>
          <input
            bind:this={inputEl}
            bind:value={newTitle}
            type="text"
            aria-label="Neue Aufgabe in den Pool"
            placeholder="Neue Aufgabe in den Pool …"
            class="flex-1 min-w-0 min-h-[44px] bg-transparent rounded"
          />
          <button
            type="button"
            class="h-9 px-2.5 rounded-lg text-[13px] font-medium hover:bg-[var(--et-surface-sunken)]"
            style="color:var(--et-text-2)"
            aria-expanded={showAddOptions}
            on:click={() => showAddOptions = !showAddOptions}
          >Optionen</button>
        </label>
        {#if showAddOptions}
          <div class="flex flex-wrap items-end gap-2 px-4 pb-3">
            <label class="flex flex-col gap-1 text-[12px] font-semibold" style="color:var(--et-text-2)">Dauer
              <select bind:value={newDuration} class="h-11 border border-[var(--et-border-strong)] rounded-[9px] px-2 text-[14px] font-normal bg-surface">
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>1 h</option>
                <option value={90}>1,5 h</option>
                <option value={120}>2 h</option>
              </select>
            </label>
            {#if activeProjects.length > 0}
              <label class="flex flex-col gap-1 text-[12px] font-semibold flex-1 min-w-[120px]" style="color:var(--et-text-2)">Projekt
                <select bind:value={newProjectId} class="h-11 border border-[var(--et-border-strong)] rounded-[9px] px-2 text-[14px] font-normal bg-surface w-full">
                  <option value="">Kein Projekt</option>
                  {#each activeProjects as p (p.id)}
                    <option value={p.id}>{p.name}</option>
                  {/each}
                </select>
              </label>
            {/if}
            <label class="flex items-center gap-2 min-h-[44px] text-[14px] cursor-pointer">
              <input type="checkbox" bind:checked={addToToday} class="w-4 h-4 accent-accent" />
              Gleich für heute
            </label>
          </div>
        {/if}
      </form>
    </section>

    <!-- ── Heute ── -->
    <section aria-label="Heute" class="flex-[999] basis-[360px] min-w-0 flex flex-col rounded-[14px] border border-border bg-surface">
      <div class="flex items-center gap-2.5 px-4 pt-3.5 pb-1.5">
        <h2 class="flex-1 text-[15px] font-semibold">Heute</h2>
        <span class="text-[12px]" style="color:var(--et-text-3)">Top 3: {mitIds.length} von 3</span>
      </div>
      <div class="flex flex-col gap-1.5 px-4 pb-3.5">
        <span
          class="h-2 rounded-[4px] flex overflow-hidden"
          style="background:var(--et-track)"
          role="img"
          aria-label="Kapazität zu {loadPercent} Prozent verplant"
        ><span class="rounded-[4px] transition-[width] duration-300" style="width:{loadPercent}%;background:{loadColor}"></span></span>
        <span class="text-[12px]" style="color:var(--et-text-3)">
          <strong class="font-semibold text-primary">{formatHm(totalMinutes)}</strong> von {formatHm(capacityMinutes)} verplant
          {#if terminMinutes > 0} · {formatHm(terminMinutes)} Termine{/if}
          · <strong class="font-semibold" style="color:{bufferColor}">{formatHm(Math.abs(bufferMinutes))} {bufferMinutes < 0 ? 'zu viel' : 'Puffer'}</strong>
        </span>
        {#if todayTasks.length > 0 && mitIds.length === 0}
          <span class="text-[12px]" style="color:var(--et-text-3)">Markiere bis zu 3 Aufgaben mit dem Stern als Top 3.</span>
        {/if}
      </div>

      <!-- Task rows + drop zone -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div
        class="transition-colors {todayDropActive && dragSource === 'pool' ? 'bg-[var(--et-accent-soft)]' : ''}"
        on:dragover={onDragOverTodayZone}
        on:drop={onDrop}
        on:dragleave={() => { todayDropActive = false; }}
      >
        {#each todayTasks as task (task.id)}
          {@const isMit = mitIds.includes(task.id)}
          {@const col = projectColor(task)}
          {@const proj = projects.find(p => p.id === task.projectId)}
          {@const proposal = proposalFor.get(task.id)}
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div
            class="group flex items-center gap-2 min-h-[52px] pl-2 pr-3 py-1 border-t border-[var(--et-border-subtle)] cursor-grab select-none
              {!task.scheduledStart ? 'bg-[#FDF6EC]' : ''}
              {draggingId === task.id && dragSource === 'today' ? 'opacity-30' : ''}
              {dragOverId === task.id && dragSource === 'today' ? 'border-t-2 !border-t-accent' : ''}"
            draggable="true"
            on:dragstart={e => onDragStartToday(e, task.id)}
            on:dragover={e => onDragOverToday(e, task.id)}
            on:drop={onDrop}
            on:dragend={onDragEnd}
          >
            <button
              on:click={() => toggleMit(task.id)}
              class="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--et-surface-sunken)] disabled:cursor-not-allowed"
              style="color:{isMit ? 'var(--et-warning)' : 'var(--et-border-control)'}"
              aria-label={isMit ? 'Aus Top 3 entfernen' : mitIds.length < 3 ? 'Als Top 3 markieren' : 'Top 3 ist voll'}
              aria-pressed={isMit}
              disabled={!isMit && mitIds.length >= 3}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={isMit ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9l-5.4 2.9 1.1-6.1L3.2 9.4l6.1-.8z"></path></svg>
            </button>

            <span class="flex-1 min-w-0 flex flex-col">
              <span class="font-semibold truncate">{task.title}</span>
              <span class="flex items-center gap-1.5 text-[12px] truncate" style="color:var(--et-text-3)">
                {#if col}<span class="w-[7px] h-[7px] rounded-full flex-shrink-0" style="background:{col}" aria-hidden="true"></span>{/if}
                {proj?.name ?? 'Ohne Projekt'}
              </span>
            </span>

            <!-- Quick scheduling, shown on hover or keyboard focus -->
            <div class="flex items-center gap-0.5 max-w-0 overflow-hidden opacity-0 group-hover:max-w-[260px] group-hover:opacity-100 group-focus-within:max-w-[260px] group-focus-within:opacity-100 transition-[opacity,max-width]">
              {#if task.scheduledStart}
                <button
                  class="h-9 px-2 rounded-lg text-[12px] font-medium hover:bg-[var(--et-surface-sunken)]"
                  style="color:var(--et-text-2)"
                  on:click={() => unscheduleTask(task)}
                >Zeit lösen</button>
              {:else}
                <button class="h-9 px-2 rounded-lg text-[12px] font-medium hover:bg-[var(--et-surface-sunken)]" style="color:var(--et-accent-strong)" on:click={() => autoPlanTask(task)} title="Nächsten freien Slot finden">Auto</button>
                <button class="h-9 px-2 rounded-lg text-[12px] font-medium hover:bg-[var(--et-surface-sunken)]" style="color:var(--et-text-2)" on:click={() => quickSchedule(task, '09:00')} title="Um 09:00 einplanen">09:00</button>
                <button class="h-9 px-2 rounded-lg text-[12px] font-medium hover:bg-[var(--et-surface-sunken)]" style="color:var(--et-text-2)" on:click={() => quickSchedule(task, '13:00')} title="Um 13:00 einplanen">13:00</button>
              {/if}
              <button
                on:click={() => removeFromToday(task)}
                class="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--et-surface-sunken)]"
                style="color:var(--et-text-3)"
                aria-label="{task.title} aus Heute entfernen"
                title="Aus Heute entfernen"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>
              </button>
            </div>

            {#if task.scheduledStart}
              <span class="text-[12px] font-semibold px-2 py-[3px] rounded-md tabular-nums" style="background:var(--et-accent-soft);color:var(--et-accent-strong)">{formatScheduledTime(task.scheduledStart)}</span>
            {:else if proposal}
              <span class="text-[12px] font-semibold px-2 py-[3px] rounded-md tabular-nums whitespace-nowrap" style="border:1.5px dashed var(--et-warning-text);color:var(--et-warning-text);background:var(--et-surface)">Vorschlag {formatScheduledTime(proposal.start)}</span>
            {:else}
              <span class="text-[12px] font-semibold px-2 py-[3px] rounded-md whitespace-nowrap" style="background:var(--et-warning-soft);color:var(--et-warning-text)">ohne Zeitslot</span>
            {/if}

            {#if editDurationId === task.id}
              <!-- svelte-ignore a11y-autofocus -->
              <input
                type="number"
                class="w-16 h-9 px-1 border rounded-lg text-[13px] text-center bg-surface"
                style="border-color:var(--et-accent)"
                aria-label="Dauer in Minuten"
                value={task.estimatedMinutes ?? 30}
                min="5" step="5" autofocus
                on:blur={e => commitDuration(task, e.currentTarget.value)}
                on:keydown={e => { if (e.key === 'Enter') commitDuration(task, e.currentTarget.value); if (e.key === 'Escape') editDurationId = null; }}
              />
            {:else}
              <button
                class="min-w-[52px] h-9 rounded-lg text-[13px] text-right tabular-nums px-1 hover:bg-[var(--et-surface-sunken)]"
                style="color:var(--et-text-3)"
                on:click={() => editDurationId = task.id}
                title="Dauer ändern"
                aria-label="Dauer ändern, aktuell {formatHm(task.estimatedMinutes ?? 0)}"
              >{formatHm(task.estimatedMinutes ?? 0)}</button>
            {/if}
          </div>
        {/each}

        {#if todayTasks.length === 0}
          <div class="px-4 py-8 text-center border-t border-[var(--et-border-subtle)]">
            <p class="text-[14px] font-semibold mb-1" style="color:var(--et-text-2)">Noch leer</p>
            <p class="text-[13px] leading-relaxed" style="color:var(--et-text-3)">
              Wähle mit dem Pfeil Aufgaben aus dem Pool,<br />ziehe sie hierher oder lege eine neue an.
            </p>
          </div>
        {/if}
      </div>

      {#if unscheduledCount > 0}
        <div class="flex flex-wrap items-center gap-3 px-4 py-3 border-t border-border">
          {#if proposals.length > 0}
            <span class="flex-1 basis-[200px] text-[13px]" style="color:var(--et-text-2)">Vorschlag für {proposals.length} {proposals.length === 1 ? 'Aufgabe' : 'Aufgaben'} – im Kalender gestrichelt.</span>
            <button class="h-10 px-3.5 rounded-[10px] text-[14px] font-medium hover:bg-[var(--et-surface-sunken)]" style="color:var(--et-text-2)" on:click={discardProposals}>Verwerfen</button>
            <button class="h-10 px-3.5 rounded-[10px] text-white text-[14px] font-semibold hover:bg-[var(--et-accent-strong)]" style="background:var(--et-accent)" on:click={acceptProposals}>Übernehmen</button>
          {:else}
            <span class="flex-1 basis-[200px] text-[13px]" style="color:var(--et-text-2)">{unscheduledCount} {unscheduledCount === 1 ? 'Aufgabe hat' : 'Aufgaben haben'} noch keinen Zeitslot.</span>
            <button
              class="h-10 px-3.5 rounded-[10px] border text-[14px] font-semibold bg-surface hover:bg-[var(--et-accent-soft)]"
              style="border-color:var(--et-accent);color:var(--et-accent-strong)"
              on:click={proposeAutoPlan}
            >Automatisch einplanen</button>
          {/if}
        </div>
      {/if}
    </section>

    <!-- ── Kalender ── -->
    <aside aria-label="Kalender" class="flex-1 basis-[300px] max-w-[340px] min-w-0 box-border flex flex-col px-4 pt-3.5 pb-4 rounded-[14px] border border-border bg-surface h-[640px]">
      <CalendarView planningMode={true} {activeDate} proposals={proposals} />
    </aside>
  </div>
</div>
