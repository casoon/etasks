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
    (e.currentTarget as HTMLElement).classList.remove('kanban-col--drag-over');
  }
</script>

<div class="kanban-board">
  {#each KANBAN_COLUMNS as col (col.id)}
    {@const colTasks = tasksByColumn(col.id)}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="kanban-col"
      on:dragover={(e) => { e.preventDefault(); e.currentTarget.classList.add('kanban-col--drag-over'); }}
      on:dragleave={(e) => e.currentTarget.classList.remove('kanban-col--drag-over')}
      on:drop={(e) => handleDrop(e, col.id)}
    >
      <div class="kanban-col-header">
        <span class="kanban-col-title">{col.label}</span>
        <span class="kanban-col-count">{colTasks.length}</span>
      </div>

      <div class="kanban-task-list">
        {#each colTasks as task (task.id)}
          <div
            class="kanban-card {task.kanbanStatus === 'done' ? 'kanban-card--done' : ''}"
            draggable="true"
            style="border-left-color:{projectColor}"
            on:dragstart={(e) => e.dataTransfer?.setData('taskId', task.id)}
          >
            <div class="kanban-card-body">
              {#if editingId === task.id}
                <!-- svelte-ignore a11y-autofocus -->
                <input
                  class="kanban-add-input"
                  bind:value={editTitle}
                  on:blur={saveEdit}
                  on:keydown={handleEditKey}
                  autofocus
                />
                <select class="duration-select" bind:value={editDuration} on:change={saveEdit} style="margin-top:4px;font-size:11px;">
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={60}>1 h</option>
                  <option value={90}>1,5 h</option>
                  <option value={120}>2 h</option>
                </select>
              {:else}
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <p class="kanban-card-title" on:dblclick={() => startEdit(task)}>{task.title}</p>
                {#if task.notes}<p class="kanban-card-notes">{task.notes}</p>{/if}
              {/if}
            </div>
            <div class="kanban-card-footer">
              <span class="kanban-card-duration">{formatDuration(task.duration)}</span>
              <div class="kanban-card-actions">
                {#if task.kanbanStatus !== 'done'}
                  <button class="kanban-action-btn" title="Heute einplanen"
                    on:click={() => updateTask(task.id, { date: today(), scheduledAt: undefined })}>☀</button>
                {/if}
                <button class="kanban-action-btn" title="Bearbeiten" on:click={() => startEdit(task)}>✎</button>
                <button class="kanban-action-btn" title="Löschen" on:click={() => removeTask(task.id)}>×</button>
              </div>
            </div>
          </div>
        {/each}
      </div>

      {#if addingCol === col.id}
        <form class="kanban-add-form" on:submit={(e) => handleAddTask(e, col.id)}>
          <!-- svelte-ignore a11y-autofocus -->
          <input class="kanban-add-input" bind:value={addInput} placeholder="Aufgabe..."
            autofocus on:keydown={(e) => { if (e.key === 'Escape') addingCol = null; }} />
          <div class="kanban-add-buttons">
            <button type="button" class="btn-ghost" on:click={() => addingCol = null}>Abbrechen</button>
            <button type="submit" class="btn-primary">Hinzufügen</button>
          </div>
        </form>
      {:else}
        <button class="kanban-add-trigger" on:click={() => addingCol = col.id}>+ Aufgabe</button>
      {/if}
    </div>
  {/each}
</div>
