<!-- @module:projects -->
<script lang="ts">
  import TimerButton from '../widgets/TimerButton.svelte';
  import { onMount } from 'svelte';
  import { $tasks as tasksStore, addTask, updateTask } from '../../stores/taskStore';
  import type { Task, KanbanStatus } from '../../domain/types';
  import { KANBAN_COLUMNS } from '../../domain/types';
  import { daysSince, formatHm, formatTime, today } from '../../domain/dateUtils';
  import { $activeTaskId as activeTaskIdStore } from '../../stores/timerStore';
  import { deleteTaskCascade } from '../../lib/taskActions';
  import { removeBlockForTask } from '../../stores/calendarStore';
  import { getTaskDragData, hasTaskDragData, setTaskDragData } from '../../lib/taskDrag';

  export let projectId: string;
  export let projectColor: string;

  const COLUMN_LIMITS: Partial<Record<KanbanStatus, number>> = {
    in_progress: 3,
    review: 2,
  };

  const COLUMN_DESCRIPTIONS: Record<KanbanStatus, string> = {
    backlog: 'Backlog: sammeln, priorisieren, noch nicht aktiv bearbeiten.',
    in_progress: 'In Arbeit: aktiv laufende Tasks. Bewusst klein halten.',
    review: 'Review: prüfen, finalisieren, auf Abschluss vorbereiten.',
    done: 'Erledigt: abgeschlossene Tasks.',
  };

  const COLLAPSE_KEY_PREFIX = 'etasks:kanban:collapsed:';

  $: allTasks = $tasksStore;
  $: tasks = allTasks.filter(t => t.projectId === projectId && !t.recurrence);
  $: todayKey = today();
  $: boardCollapseKey = `${COLLAPSE_KEY_PREFIX}${projectId}`;
  let collapsedColumns: KanbanStatus[] = [];
  let collapsePrefsReady = false;

  onMount(() => {
    if (typeof localStorage === 'undefined') return;
    try {
      collapsedColumns = JSON.parse(localStorage.getItem(boardCollapseKey) ?? '[]');
    } catch {
      collapsedColumns = [];
    }
    collapsePrefsReady = true;
  });

  $: if (collapsePrefsReady && typeof localStorage !== 'undefined') {
    localStorage.setItem(boardCollapseKey, JSON.stringify(collapsedColumns));
  }

  function tasksByColumn(list: Task[], col: KanbanStatus) {
    return list
      .filter(t => (t.kanbanStatus ?? 'backlog') === col)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  function toggleColumn(col: KanbanStatus): void {
    collapsedColumns = collapsedColumns.includes(col)
      ? collapsedColumns.filter(id => id !== col)
      : [...collapsedColumns, col];
  }

  /** Backlog and Erledigt show this many cards until „weitere anzeigen“. */
  const COLLAPSED_CARD_LIMIT = 5;
  const LONG_LISTS: KanbanStatus[] = ['backlog', 'done'];
  let expandedLists: KanbanStatus[] = [];

  function toggleList(col: KanbanStatus): void {
    expandedLists = expandedLists.includes(col) ? expandedLists.filter(id => id !== col) : [...expandedLists, col];
  }

  $: columnTemplate = KANBAN_COLUMNS.map(c => collapsedColumns.includes(c.id) ? '76px' : 'minmax(220px, 1fr)').join(' ');

  // ── Add task ───────────────────────────────────────────────────────────────
  let addingCol: KanbanStatus | null = null;
  let addInput = '';

  function handleAddTask(e: Event, col: KanbanStatus) {
    e.preventDefault();
    const title = addInput.trim();
    if (!title) return;
    addTask(title, 30, [], projectId, col, null);
    addInput = '';
    addingCol = null;
  }

  // ── Edit card ──────────────────────────────────────────────────────────────
  let editingId: string | null = null;
  let editTitle = '';
  let editDuration = 30;

  function startEdit(task: Task) {
    editingId = task.id;
    editTitle = task.title;
    editDuration = task.estimatedMinutes ?? 30;
  }

  let editColumn: KanbanStatus = 'backlog';

  function startEditCard(task: Task) {
    startEdit(task);
    editColumn = task.kanbanStatus ?? 'backlog';
  }

  function saveEdit() {
    if (!editingId) return;
    const task = tasks.find(t => t.id === editingId);
    const t = editTitle.trim();
    if (t) updateTask(editingId, { title: t, estimatedMinutes: editDuration });
    // Moving through the form is the keyboard path for the drag and drop between columns.
    if (task && t && (task.kanbanStatus ?? 'backlog') !== editColumn) {
      const last = tasksByColumn(tasks, editColumn).length;
      updateTask(task.id, {
        kanbanStatus: editColumn,
        status: editColumn === 'done' ? 'done' : 'todo',
        completedAt: editColumn === 'done' ? new Date().toISOString() : null,
        sortOrder: last,
      });
    }
    editingId = null;
  }

  function onEditFocusOut(e: FocusEvent) {
    if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) return;
    saveEdit();
  }

  function handleEditKey(e: KeyboardEvent) {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') editingId = null;
  }

  // ── Drag & Drop ────────────────────────────────────────────────────────────
  let draggingId: string | null = null;
  let dragOverColId: KanbanStatus | null = null;
  let dragOverCardId: string | null = null;
  let dragOverPos: 'before' | 'after' = 'after';

  function onDragStart(e: DragEvent, taskId: string) {
    draggingId = taskId;
    if (!e.dataTransfer) return;
    setTaskDragData(e.dataTransfer, taskId);
  }

  function onDragEnd() {
    draggingId = null;
    dragOverColId = null;
    dragOverCardId = null;
  }

  function onColDragOver(e: DragEvent, colId: KanbanStatus) {
    if (!hasTaskDragData(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    dragOverColId = colId;
  }

  function onColDragLeave(e: DragEvent) {
    const related = e.relatedTarget as Node | null;
    if (!(e.currentTarget as HTMLElement).contains(related)) {
      dragOverColId = null;
      dragOverCardId = null;
    }
  }

  function onCardDragOver(e: DragEvent, cardId: string) {
    if (!hasTaskDragData(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    dragOverColId = null;
    dragOverCardId = cardId;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragOverPos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  }

  function onDrop(e: DragEvent, targetColId: KanbanStatus) {
    e.preventDefault();
    const taskId = getTaskDragData(e.dataTransfer);
    if (!taskId) { onDragEnd(); return; }

    const task = tasksStore.get().find(t => t.id === taskId);
    if (!task) { onDragEnd(); return; }

    // Build ordered list for target column, without the dragged card
    const colTasks = tasksByColumn(tasks, targetColId).filter(t => t.id !== taskId);

    let insertIdx: number;
    if (dragOverCardId) {
      const targetIdx = colTasks.findIndex(t => t.id === dragOverCardId);
      if (targetIdx === -1) {
        insertIdx = colTasks.length;
      } else {
        insertIdx = dragOverPos === 'before' ? targetIdx : targetIdx + 1;
      }
    } else {
      insertIdx = colTasks.length;
    }

    colTasks.splice(insertIdx, 0, task);
    colTasks.forEach((t, i) => {
      const patch: Partial<Task> = {};
      if (t.sortOrder !== i) patch.sortOrder = i;
      if ((t.kanbanStatus ?? 'backlog') !== targetColId) {
        patch.kanbanStatus = targetColId;
        patch.status = targetColId === 'done' ? 'done' : 'todo';
        patch.completedAt = targetColId === 'done' ? new Date().toISOString() : null;
      }
      const keys = Object.keys(patch);
      if (keys.length > 0) updateTask(t.id, patch, { touch: !(keys.length === 1 && keys[0] === 'sortOrder') });
    });

    onDragEnd();
  }
</script>

<div class="overflow-x-auto pb-2">
<div class="grid gap-4 items-start" style="grid-template-columns:{columnTemplate}">
  {#each KANBAN_COLUMNS as col (col.id)}
    {@const allColTasks = tasksByColumn(tasks, col.id)}
    {@const isColActive = dragOverColId === col.id}
    {@const limit = COLUMN_LIMITS[col.id] ?? null}
    {@const overLimit = limit != null && allColTasks.length > limit}
    {@const collapsed = collapsedColumns.includes(col.id)}
    {@const capped = LONG_LISTS.includes(col.id) && !expandedLists.includes(col.id) && allColTasks.length > COLLAPSED_CARD_LIMIT}
    {@const colTasks = capped ? allColTasks.slice(0, COLLAPSED_CARD_LIMIT) : allColTasks}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <section
      aria-label={col.label}
      class="flex flex-col gap-2 p-3 rounded-xl min-w-0 transition-colors"
      style="background:{isColActive ? 'var(--et-accent-soft)' : 'var(--et-track)'}"
      on:dragover={(e) => onColDragOver(e, col.id)}
      on:dragleave={onColDragLeave}
      on:drop={(e) => onDrop(e, col.id)}
    >
      <div class="flex items-center gap-2 px-1 pb-1 {collapsed ? 'flex-col' : ''}">
        <button
          class="et-btn et-btn-ghost et-btn-icon et-btn-sm flex-shrink-0"
          aria-expanded={!collapsed}
          aria-label="{col.label} {collapsed ? 'ausklappen' : 'einklappen'}"
          title={COLUMN_DESCRIPTIONS[col.id]}
          on:click={() => toggleColumn(col.id)}
        >
          <svg class="transition-transform {collapsed ? '-rotate-90' : ''}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>
        </button>
        <h2 class="flex-1 text-[13px] font-semibold {collapsed ? 'text-center' : 'truncate'}" title={COLUMN_DESCRIPTIONS[col.id]}>{col.label}</h2>
        {#if overLimit}<span class="et-badge et-badge-red">Limit überschritten</span>{/if}
        <span class="text-[12px] whitespace-nowrap" style="color:var(--et-text-3)">{limit != null ? `${allColTasks.length} von max. ${limit}` : allColTasks.length}</span>
      </div>

      {#if !collapsed}
        {#each colTasks as task (task.id)}
          {@const isOver = dragOverCardId === task.id}
          {@const backlogAge = col.id === 'backlog' ? daysSince(task.updatedAt, todayKey) : null}
          {@const running = $activeTaskIdStore === task.id}
          {@const isDone = task.status === 'done'}
          {@const overdue = !isDone && !!task.plannedDate && task.plannedDate < todayKey}
          {@const forToday = !isDone && task.plannedDate === todayKey}
          {#if isOver && dragOverPos === 'before'}
            <div class="h-[3px] rounded-full mx-1 flex-shrink-0" style="background:{projectColor}"></div>
          {/if}

          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div
            class="flex flex-col gap-2.5 p-3 rounded-[10px] min-w-0 cursor-grab select-none
              {draggingId === task.id ? 'opacity-30' : ''}"
            style="background:{isDone ? 'var(--et-surface-sunken)' : 'var(--et-surface)'};border:{running ? '1.5px solid var(--et-accent)' : '1px solid var(--et-border)'}{isOver ? ';box-shadow:0 0 0 2px ' + projectColor : ''}"
            draggable="true"
            on:dragstart={(e) => onDragStart(e, task.id)}
            on:dragend={onDragEnd}
            on:dragover={(e) => onCardDragOver(e, task.id)}
          >
            {#if editingId === task.id}
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <div class="flex flex-col gap-2" on:focusout={onEditFocusOut}>
                <label class="et-label" for="kb-title-{task.id}">Titel</label>
                <!-- svelte-ignore a11y-autofocus -->
                <input id="kb-title-{task.id}" class="et-field" bind:value={editTitle} on:keydown={handleEditKey} autofocus />
                <label class="et-label" for="kb-dur-{task.id}">Dauer</label>
                <select id="kb-dur-{task.id}" class="et-field" bind:value={editDuration}>
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={60}>1 h</option>
                  <option value={90}>1,5 h</option>
                  <option value={120}>2 h</option>
                </select>
                <label class="et-label" for="kb-col-{task.id}">Spalte</label>
                <select id="kb-col-{task.id}" class="et-field" bind:value={editColumn}>
                  {#each KANBAN_COLUMNS as c (c.id)}<option value={c.id}>{c.label}</option>{/each}
                </select>
                <div class="flex gap-2">
                  <button class="et-btn et-btn-primary et-btn-sm" on:click={saveEdit}>Speichern</button>
                  <button class="et-btn et-btn-sm" on:click={() => (editingId = null)}>Abbrechen</button>
                </div>
              </div>
            {:else}
              <span class="break-words {running ? 'font-semibold' : 'font-medium'} {isDone ? 'line-through' : ''}" style={isDone ? 'color:var(--et-text-3)' : ''}>{task.title}</span>
              {#if task.notes}<span class="text-[12px] truncate" style="color:var(--et-text-3)">{task.notes}</span>{/if}
              <span class="flex flex-wrap items-center gap-2 text-[12px]" style="color:var(--et-text-3)">
                <span>
                  {#if (task.trackedSeconds ?? 0) > 0}{formatHm((task.trackedSeconds ?? 0) / 60)}{task.estimatedMinutes ? ` von ${formatHm(task.estimatedMinutes)}` : ' erfasst'}{:else}{formatHm(task.estimatedMinutes ?? 0)}{/if}
                </span>
                {#if running}
                  <span class="et-badge et-badge-blue">{forToday ? 'heute · ' : ''}Timer läuft</span>
                {:else if forToday}
                  <span class="et-badge et-badge-blue">heute{task.scheduledStart ? ` ${formatTime(task.scheduledStart)}` : ''}</span>
                {:else if overdue}
                  <span class="et-badge et-badge-red">überfällig</span>
                {/if}
                {#if backlogAge != null && backlogAge >= 7}
                  <span class="font-semibold" style="color:var(--et-warning-text)">seit {backlogAge} Tagen</span>
                {/if}
              </span>
              <span class="flex flex-wrap items-center gap-1.5">
                {#if !isDone}
                  <TimerButton taskId={task.id} variant="round" />
                  <button
                    class="et-btn et-btn-sm"
                    on:click={() => { removeBlockForTask(task.id); updateTask(task.id, { plannedDate: today(), scheduledStart: null, scheduledEnd: null }); }}
                  >Für heute</button>
                {/if}
                <button class="et-btn et-btn-sm et-btn-ghost et-btn-icon" aria-label="Aufgabe „{task.title}“ bearbeiten" on:click={() => startEditCard(task)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"></path></svg>
                </button>
                <button class="et-btn et-btn-sm et-btn-ghost et-btn-icon" aria-label="Aufgabe „{task.title}“ löschen" on:click={() => deleteTaskCascade(task.id)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"></path></svg>
                </button>
              </span>
            {/if}
          </div>

          {#if isOver && dragOverPos === 'after'}
            <div class="h-[3px] rounded-full mx-1 flex-shrink-0" style="background:{projectColor}"></div>
          {/if}
        {/each}

        {#if LONG_LISTS.includes(col.id) && allColTasks.length > COLLAPSED_CARD_LIMIT}
          <button class="et-btn et-btn-ghost et-btn-sm justify-start" aria-expanded={!capped} on:click={() => toggleList(col.id)}>
            {capped ? `${allColTasks.length - COLLAPSED_CARD_LIMIT} ${col.id === 'done' ? 'ältere' : 'weitere'} anzeigen` : 'Weniger anzeigen'}
          </button>
        {/if}

        {#if isColActive && !dragOverCardId && colTasks.length === 0}
          <div class="flex items-center justify-center rounded-[10px] border-2 border-dashed min-h-[60px]" style="border-color:{projectColor}">
            <span class="text-[12px]" style="color:var(--et-text-2)">Hier ablegen</span>
          </div>
        {/if}

        {#if addingCol === col.id}
          <form class="flex flex-col gap-2" on:submit={(e) => handleAddTask(e, col.id)}>
            <label class="et-label" for="kb-add-{col.id}">Neue Aufgabe in {col.label}</label>
            <!-- svelte-ignore a11y-autofocus -->
            <input id="kb-add-{col.id}" class="et-field" bind:value={addInput} autofocus on:keydown={(e) => { if (e.key === 'Escape') addingCol = null; }} />
            <div class="flex gap-2">
              <button type="submit" class="et-btn et-btn-primary et-btn-sm">Hinzufügen</button>
              <button type="button" class="et-btn et-btn-sm" on:click={() => (addingCol = null)}>Abbrechen</button>
            </div>
          </form>
        {:else}
          <button
            class="h-11 rounded-[10px] border border-dashed font-medium transition-colors hover:bg-[var(--et-surface-sunken)]"
            style="border-color:var(--et-border-control);color:var(--et-text-2)"
            on:click={() => (addingCol = col.id)}
          >{tasks.length === 0 && col.id === 'backlog' ? '+ Erste Aufgabe anlegen' : '+ Aufgabe'}</button>
        {/if}
      {/if}
    </section>
  {/each}
</div>
</div>
