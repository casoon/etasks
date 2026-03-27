<script lang="ts">
  import { $todayTasks as todayTasksStore, updateTask, addTask } from '../stores/taskStore';
  import { $projects as projectsStore } from '../stores/projectStore';
  import type { Task, KanbanStatus } from '../domain/types';
  import { formatDuration, today } from '../domain/dateUtils';

  const COLUMNS = [
    { id: 'todo' as const, label: 'Offen' },
    { id: 'in_progress' as const, label: 'In Arbeit' },
    { id: 'done' as const, label: 'Erledigt' },
  ];

  $: tasks = $todayTasksStore;
  $: projects = $projectsStore;

  function getEffectiveStatus(task: Task): 'todo' | 'in_progress' | 'done' {
    if (task.status === 'done') return 'done';
    if (task.kanbanStatus === 'in_progress') return 'in_progress';
    return 'todo';
  }

  function applyStatus(taskId: string, col: string) {
    if (col === 'done') updateTask(taskId, { status: 'done', kanbanStatus: 'done' });
    else if (col === 'in_progress') updateTask(taskId, { status: 'todo', kanbanStatus: 'in_progress' });
    else updateTask(taskId, { status: 'todo', kanbanStatus: 'backlog' });
  }

  function tasksByCol(col: string) {
    return tasks.filter(t => getEffectiveStatus(t) === col);
  }

  // Per-column add state
  let addingCol: string | null = null;
  let addInput = '';

  // Per-card edit
  let editingId: string | null = null;
  let editTitle = '';

  function startEdit(task: Task) { editingId = task.id; editTitle = task.title; }
  function saveEdit() {
    if (!editingId) return;
    const t = editTitle.trim();
    if (t) updateTask(editingId, { title: t });
    editingId = null;
  }

  function handleAdd(e: Event, col: string) {
    e.preventDefault();
    const title = addInput.trim();
    if (!title) return;
    addTask(title, 30, []);
    if (col !== 'todo') {
      setTimeout(() => {
        const all = todayTasksStore.get();
        const last = all[all.length - 1];
        if (last) applyStatus(last.id, col);
      }, 0);
    }
    addInput = '';
    addingCol = null;
  }

  function handleDrop(e: DragEvent, col: string) {
    e.preventDefault();
    const taskId = e.dataTransfer?.getData('taskId');
    if (taskId) applyStatus(taskId, col);
    (e.currentTarget as HTMLElement).classList.remove('kanban-col--drag-over');
  }
</script>

<div class="board-view">
  {#each COLUMNS as col (col.id)}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="kanban-col"
      on:dragover={(e) => { e.preventDefault(); e.currentTarget.classList.add('kanban-col--drag-over'); }}
      on:dragleave={(e) => e.currentTarget.classList.remove('kanban-col--drag-over')}
      on:drop={(e) => handleDrop(e, col.id)}
    >
      <div class="kanban-col-header">
        <span class="kanban-col-title">{col.label}</span>
        <span class="kanban-col-count">{tasksByCol(col.id).length}</span>
      </div>

      <div class="kanban-task-list">
        {#each tasksByCol(col.id) as task (task.id)}
          {@const project = task.projectId ? projects.find(p => p.id === task.projectId) : null}
          <div
            class="kanban-card {col.id === 'done' ? 'kanban-card--done' : ''}"
            draggable="true"
            style="border-left-color:{project?.color ?? 'var(--color-border)'}"
            on:dragstart={(e) => e.dataTransfer?.setData('taskId', task.id)}
          >
            {#if editingId === task.id}
              <!-- svelte-ignore a11y-autofocus -->
              <input class="kanban-add-input" bind:value={editTitle}
                on:blur={saveEdit}
                on:keydown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') editingId = null; }}
                autofocus />
            {:else}
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <p class="kanban-card-title" on:dblclick={() => startEdit(task)}>{task.title}</p>
            {/if}
            <div class="kanban-card-footer">
              <span class="kanban-card-duration">{formatDuration(task.duration)}</span>
              {#if project}<span class="kanban-card-project">{project.name}</span>{/if}
              <button class="kanban-action-btn" title="Bearbeiten" on:click={() => startEdit(task)}>✎</button>
            </div>
          </div>
        {/each}
      </div>

      {#if addingCol === col.id}
        <form class="kanban-add-form" on:submit={(e) => handleAdd(e, col.id)}>
          <!-- svelte-ignore a11y-autofocus -->
          <input class="kanban-add-input" bind:value={addInput} placeholder="Aufgabe..."
            autofocus on:keydown={(e) => { if (e.key === 'Escape') addingCol = null; }} />
          <div class="kanban-add-buttons">
            <button type="button" class="btn-ghost" on:click={() => addingCol = null}>✕</button>
            <button type="submit" class="btn-primary">+</button>
          </div>
        </form>
      {:else}
        <button class="kanban-add-trigger" on:click={() => addingCol = col.id}>+ Aufgabe</button>
      {/if}
    </div>
  {/each}
</div>
