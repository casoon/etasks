<!-- @module:projects -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { $tasks as tasksStore, addTask, updateTask, removeTask } from '../../stores/taskStore';
  import type { Task, KanbanStatus } from '../../domain/types';
  import { KANBAN_COLUMNS } from '../../domain/types';
  import { daysSince, formatDuration, isToday, today } from '../../domain/dateUtils';
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
  $: tasks = allTasks.filter(t => t.projectId === projectId);
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

  function tasksByColumn(col: KanbanStatus) {
    return tasks
      .filter(t => (t.kanbanStatus ?? 'backlog') === col)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  function isCollapsed(col: KanbanStatus): boolean {
    return collapsedColumns.includes(col);
  }

  function toggleColumn(col: KanbanStatus): void {
    collapsedColumns = isCollapsed(col)
      ? collapsedColumns.filter(id => id !== col)
      : [...collapsedColumns, col];
  }

  function columnLimit(col: KanbanStatus): number | null {
    return COLUMN_LIMITS[col] ?? null;
  }

  function isOverLimit(col: KanbanStatus): boolean {
    const limit = columnLimit(col);
    return limit != null && tasksByColumn(col).length > limit;
  }

  function cardAccent(task: Task): string {
    if (task.status !== 'done' && task.plannedDate && task.plannedDate < todayKey) return '#dc2626';
    if (task.status !== 'done' && task.plannedDate === todayKey) return '#d97706';
    if (task.status !== 'done' && task.scheduledStart) return '#2563eb';
    return projectColor;
  }

  // ── Add task ───────────────────────────────────────────────────────────────
  let addingCol: KanbanStatus | null = null;
  let addInput = '';

  function handleAddTask(e: Event, col: KanbanStatus) {
    e.preventDefault();
    const title = addInput.trim();
    if (!title) return;
    addTask(title, 30, [], projectId, col);
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

  function saveEdit() {
    if (!editingId) return;
    const t = editTitle.trim();
    if (t) updateTask(editingId, { title: t, estimatedMinutes: editDuration });
    editingId = null;
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
    const colTasks = tasksByColumn(targetColId).filter(t => t.id !== taskId);

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
      updateTask(t.id, {
        kanbanStatus: targetColId,
        status: targetColId === 'done' ? 'done' : 'todo',
        sortOrder: i,
      });
    });

    onDragEnd();
  }
</script>

<div class="grid flex-1 overflow-hidden gap-px bg-border" style="grid-template-columns: repeat(4, 1fr)">
  {#each KANBAN_COLUMNS as col (col.id)}
    {@const colTasks = tasksByColumn(col.id)}
    {@const isColActive = dragOverColId === col.id}
    {@const limit = columnLimit(col.id)}
    {@const overLimit = limit != null && colTasks.length > limit}
    {@const collapsed = isCollapsed(col.id)}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="flex flex-col overflow-hidden transition-colors min-w-0 {isColActive ? 'bg-accent-subtle/40' : 'bg-bg'} {collapsed ? 'max-w-[68px]' : ''}"
      on:dragover={(e) => onColDragOver(e, col.id)}
      on:dragleave={onColDragLeave}
      on:drop={(e) => onDrop(e, col.id)}
    >
      <div class="flex items-center gap-2 px-3 py-3 bg-surface flex-shrink-0 border-b border-border">
        <button
          class="text-[11px] text-muted hover:text-primary transition-colors flex-shrink-0"
          title={collapsed ? 'Spalte ausklappen' : 'Spalte einklappen'}
          on:click={() => toggleColumn(col.id)}
        >{collapsed ? '▸' : '▾'}</button>
        <span
          class="text-[11px] font-bold uppercase tracking-[0.07em] flex-1 overflow-hidden text-ellipsis whitespace-nowrap {overLimit ? 'text-red-600' : 'text-muted'}"
          title={COLUMN_DESCRIPTIONS[col.id]}
        >{collapsed ? col.label.slice(0, 3) : col.label}</span>
        <span class="text-[11px] px-[6px] py-[1px] rounded-lg flex-shrink-0 {overLimit ? 'text-red-700 bg-red-50' : 'text-muted bg-bg'}">
          {limit != null ? `${colTasks.length}/${limit}` : colTasks.length}
        </span>
      </div>

      {#if !collapsed}
      <div class="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
        {#each colTasks as task, i (task.id)}
          {@const isOver = dragOverCardId === task.id}
          {@const backlogAge = col.id === 'backlog' ? daysSince(task.updatedAt, todayKey) : null}
          {@const createdToday = isToday(task.createdAt, todayKey)}
          {@const updatedToday = isToday(task.updatedAt, todayKey)}
          <!-- Insert indicator BEFORE -->
          {#if isOver && dragOverPos === 'before'}
            <div class="h-[2px] rounded-full mx-1 flex-shrink-0" style="background:{projectColor}"></div>
          {/if}

          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div
            class="bg-surface rounded-lg p-3 border-l-[3px] shadow-card cursor-grab select-none flex flex-col gap-2
              transition-all hover:shadow-[0_4px_16px_rgba(0,0,0,0.10)] active:scale-[0.98] min-w-0
              {task.kanbanStatus === 'done' ? 'opacity-55' : ''}
              {draggingId === task.id ? 'opacity-30 scale-95' : ''}
              {isOver ? 'ring-1 ring-inset' : ''}
              {(createdToday || updatedToday) ? 'kanban-card--recent' : ''}"
            draggable="true"
            style="border-left-color:{cardAccent(task)}{isOver ? '; --tw-ring-color:' + projectColor : ''}"
            on:dragstart={(e) => onDragStart(e, task.id)}
            on:dragend={onDragEnd}
            on:dragover={(e) => onCardDragOver(e, task.id)}
            title={createdToday ? 'Heute erstellt' : updatedToday ? 'Heute aktualisiert' : ''}
          >
            <div class="flex flex-col gap-1 min-w-0">
              {#if editingId === task.id}
                <!-- svelte-ignore a11y-autofocus -->
                <input
                  class="w-full px-2 py-2 border border-accent rounded-lg text-[13px] outline-none bg-surface"
                  bind:value={editTitle}
                  on:blur={saveEdit}
                  on:keydown={handleEditKey}
                  autofocus
                />
                <select class="border border-border rounded-md px-2 py-[2px] text-[11px] bg-bg outline-none mt-1" bind:value={editDuration} on:change={saveEdit}>
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={60}>1 h</option>
                  <option value={90}>1,5 h</option>
                  <option value={120}>2 h</option>
                </select>
              {:else}
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <p
                  class="text-[13px] text-primary leading-[1.4] overflow-hidden {task.kanbanStatus === 'done' ? 'line-through' : ''}"
                  style="-webkit-line-clamp:3;display:-webkit-box;-webkit-box-orient:vertical;"
                  on:dblclick={() => startEdit(task)}
                >{task.title}</p>
                {#if task.notes}<p class="text-[12px] text-secondary overflow-hidden text-ellipsis whitespace-nowrap">{task.notes}</p>{/if}
              {/if}
            </div>
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 text-[11px] text-muted whitespace-nowrap overflow-hidden">
                <span title="Schätzung">⏱ {formatDuration(task.estimatedMinutes ?? 0)}</span>
                {#if task.notes}
                  <span title="Notizen vorhanden">📝</span>
                {/if}
                {#if task.recurrence}
                  <span title="Wiederkehrend">↺</span>
                {/if}
                {#if task.scheduledStart}
                  <span title="Eingeplant">◷</span>
                {/if}
                {#if backlogAge != null && backlogAge >= 7}
                  <span title={`Seit ${backlogAge} Tagen im Backlog`}>⌛ {backlogAge}d</span>
                {/if}
              </div>
              <div class="flex gap-1">
                {#if task.kanbanStatus !== 'done'}
                  <button
                    class="text-[13px] text-muted px-1 py-0.5 rounded transition-colors hover:bg-bg hover:text-accent"
                    title="Heute einplanen"
                    on:click={() => updateTask(task.id, { plannedDate: today(), scheduledStart: null })}
                  >☀</button>
                {/if}
                <button
                  class="text-[13px] text-muted px-1 py-0.5 rounded transition-colors hover:bg-bg hover:text-accent"
                  title="Bearbeiten"
                  on:click={() => startEdit(task)}
                >✎</button>
                <button
                  class="text-[13px] text-muted px-1 py-0.5 rounded transition-colors hover:bg-bg hover:text-accent"
                  title="Löschen"
                  on:click={() => removeTask(task.id)}
                >×</button>
              </div>
            </div>
          </div>

          <!-- Insert indicator AFTER -->
          {#if isOver && dragOverPos === 'after'}
            <div class="h-[2px] rounded-full mx-1 flex-shrink-0" style="background:{projectColor}"></div>
          {/if}
        {/each}

        <!-- Drop indicator at end when column is empty or dragging over empty space -->
        {#if isColActive && !dragOverCardId && colTasks.length === 0}
          <div class="flex-1 flex items-center justify-center rounded-lg border-2 border-dashed transition-colors min-h-[60px]" style="border-color:{projectColor}44">
            <span class="text-[11px]" style="color:{projectColor}99">Hier ablegen</span>
          </div>
        {/if}
      </div>
      {/if}

      {#if addingCol === col.id}
        <form class="p-2 flex flex-col gap-2 flex-shrink-0" on:submit={(e) => handleAddTask(e, col.id)}>
          <!-- svelte-ignore a11y-autofocus -->
          <input
            class="w-full px-2 py-2 border border-accent rounded-lg text-[13px] outline-none bg-surface"
            bind:value={addInput}
            placeholder="Aufgabe..."
            autofocus
            on:keydown={(e) => { if (e.key === 'Escape') addingCol = null; }}
          />
          <div class="flex gap-2 justify-end">
            <button type="button" class="px-3 py-1 text-secondary rounded-lg text-[13px] hover:bg-gray-100 transition-colors whitespace-nowrap" on:click={() => addingCol = null}>Abbrechen</button>
            <button type="submit" class="px-3 py-1 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-blue-600 transition-colors whitespace-nowrap">Hinzufügen</button>
          </div>
        </form>
      {:else if tasks.length === 0 && col.id === 'backlog'}
        <button
          class="mx-2 mb-2 px-3 py-2 rounded-lg border border-dashed border-border text-[12px] text-muted text-center transition-colors hover:border-accent hover:text-accent flex-shrink-0"
          on:click={() => addingCol = col.id}
        >+ Erste Aufgabe anlegen</button>
      {:else}
        <button
          class="px-3 py-2 text-muted text-[12px] text-left transition-colors hover:text-primary flex-shrink-0"
          on:click={() => addingCol = col.id}
        >+ Aufgabe</button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .kanban-card--recent {
    box-shadow: inset 2px 0 0 color-mix(in srgb, var(--color-accent) 55%, transparent);
  }
</style>
