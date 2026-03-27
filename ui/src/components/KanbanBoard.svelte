<script lang="ts">
  import { $tasks as tasksStore, addTask, updateTask, removeTask } from '../stores/taskStore';
  import type { Task, KanbanStatus } from '../domain/types';
  import { KANBAN_COLUMNS } from '../domain/types';
  import { formatDuration, today } from '../domain/dateUtils';

  export let projectId: string;
  export let projectColor: string;

  $: allTasks = $tasksStore;
  $: tasks = allTasks.filter(t => t.projectId === projectId);

  function tasksByColumn(col: KanbanStatus) {
    return tasks.filter(t => (t.kanbanStatus ?? 'backlog') === col).sort((a, b) => a.order - b.order);
  }

  function handleStatusChange(task: Task, newStatus: KanbanStatus) {
    updateTask(task.id, { kanbanStatus: newStatus, status: newStatus === 'done' ? 'done' : 'todo' });
  }

  // Per-column state
  let addingCol: KanbanStatus | null = null;
  let addInput = '';

  // Per-card edit state
  let editingId: string | null = null;
  let editTitle = '';
  let editDuration = 30;

  function startEdit(task: Task) {
    editingId = task.id;
    editTitle = task.title;
    editDuration = task.duration;
  }

  function saveEdit() {
    if (!editingId) return;
    const t = editTitle.trim();
    if (t) updateTask(editingId, { title: t, duration: editDuration });
    editingId = null;
  }

  function handleEditKey(e: KeyboardEvent) {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') editingId = null;
  }

  function handleAddTask(e: Event, col: KanbanStatus) {
    e.preventDefault();
    const title = addInput.trim();
    if (!title) return;
    addTask(title, 30, [], projectId, col);
    addInput = '';
    addingCol = null;
  }

  function handleDrop(e: DragEvent, col: KanbanStatus) {
    e.preventDefault();
    const taskId = (e as any).dataTransfer.getData('taskId');
    const task = tasksStore.get().find(t => t.id === taskId);
    if (task) handleStatusChange(task, col);
    (e.currentTarget as HTMLElement).classList.remove('!bg-accent-subtle');
  }
</script>

<div class="grid flex-1 overflow-hidden gap-px bg-border" style="grid-template-columns: repeat(4, 1fr)">
  {#each KANBAN_COLUMNS as col (col.id)}
    {@const colTasks = tasksByColumn(col.id)}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="bg-bg flex flex-col overflow-hidden transition-colors min-w-0"
      on:dragover={(e) => { e.preventDefault(); e.currentTarget.classList.add('!bg-accent-subtle'); }}
      on:dragleave={(e) => e.currentTarget.classList.remove('!bg-accent-subtle')}
      on:drop={(e) => handleDrop(e, col.id)}
    >
      <div class="flex items-center gap-2 px-4 py-3 bg-surface flex-shrink-0 border-b border-border">
        <span class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{col.label}</span>
        <span class="text-[11px] text-muted bg-bg px-[6px] py-[1px] rounded-lg flex-shrink-0">{colTasks.length}</span>
      </div>

      <div class="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {#each colTasks as task (task.id)}
          <div
            class="bg-surface rounded-lg p-3 border-l-[3px] shadow-card cursor-grab select-none flex flex-col gap-2 transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.10)] active:scale-[0.98] min-w-0 {task.kanbanStatus === 'done' ? 'opacity-55' : ''}"
            draggable="true"
            style="border-left-color:{projectColor}"
            on:dragstart={(e) => e.dataTransfer?.setData('taskId', task.id)}
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
              <span class="text-[11px] text-muted whitespace-nowrap">{formatDuration(task.duration)}</span>
              <div class="flex gap-1">
                {#if task.kanbanStatus !== 'done'}
                  <button
                    class="text-[13px] text-muted px-1 py-0.5 rounded transition-colors hover:bg-bg hover:text-accent"
                    title="Heute einplanen"
                    on:click={() => updateTask(task.id, { date: today(), scheduledAt: undefined })}
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
        {/each}
      </div>

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
      {:else}
        <button
          class="px-3 py-2 text-muted text-[12px] text-left transition-colors hover:text-primary flex-shrink-0"
          on:click={() => addingCol = col.id}
        >+ Aufgabe</button>
      {/if}
    </div>
  {/each}
</div>
