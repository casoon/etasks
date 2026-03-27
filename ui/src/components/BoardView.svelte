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
    (e.currentTarget as HTMLElement).classList.remove('drag-over');
  }
</script>

<div class="grid flex-1 overflow-hidden h-full gap-px bg-border" style="grid-template-columns: repeat(3, 1fr)">
  {#each COLUMNS as col (col.id)}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="bg-bg flex flex-col overflow-hidden transition-colors min-w-0 drag-target"
      on:dragover={(e) => { e.preventDefault(); e.currentTarget.classList.add('!bg-accent-subtle'); }}
      on:dragleave={(e) => e.currentTarget.classList.remove('!bg-accent-subtle')}
      on:drop={(e) => { handleDrop(e, col.id); e.currentTarget.classList.remove('!bg-accent-subtle'); }}
    >
      <div class="flex items-center gap-2 px-4 py-3 bg-surface flex-shrink-0 border-b border-border">
        <span class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{col.label}</span>
        <span class="text-[11px] text-muted bg-bg px-[6px] py-[1px] rounded-lg flex-shrink-0">{tasksByCol(col.id).length}</span>
      </div>

      <div class="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {#each tasksByCol(col.id) as task (task.id)}
          {@const project = task.projectId ? projects.find(p => p.id === task.projectId) : null}
          <div
            class="bg-surface rounded-lg p-3 border-l-[3px] shadow-card cursor-grab select-none flex flex-col gap-2 transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.10)] active:scale-[0.98] min-w-0 {col.id === 'done' ? 'opacity-55' : ''}"
            draggable="true"
            style="border-left-color:{project?.color ?? 'var(--color-border)'}"
            on:dragstart={(e) => e.dataTransfer?.setData('taskId', task.id)}
          >
            {#if editingId === task.id}
              <!-- svelte-ignore a11y-autofocus -->
              <input
                class="w-full px-2 py-2 border border-accent rounded-lg text-[13px] outline-none bg-surface"
                bind:value={editTitle}
                on:blur={saveEdit}
                on:keydown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') editingId = null; }}
                autofocus
              />
            {:else}
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <p
                class="text-[13px] text-primary leading-[1.4] overflow-hidden {col.id === 'done' ? 'line-through' : ''}"
                style="-webkit-line-clamp:3;display:-webkit-box;-webkit-box-orient:vertical;"
                on:dblclick={() => startEdit(task)}
              >{task.title}</p>
            {/if}
            <div class="flex items-center justify-between gap-2">
              <span class="text-[11px] text-muted whitespace-nowrap">{formatDuration(task.estimatedMinutes ?? 0)}</span>
              {#if project}<span class="text-[11px] text-muted overflow-hidden text-ellipsis whitespace-nowrap max-w-[80px]">{project.name}</span>{/if}
              <button
                class="text-[13px] text-muted px-1 py-0.5 rounded transition-colors hover:bg-bg hover:text-accent"
                title="Bearbeiten"
                on:click={() => startEdit(task)}
              >✎</button>
            </div>
          </div>
        {/each}
      </div>

      {#if addingCol === col.id}
        <form class="p-2 flex flex-col gap-2 flex-shrink-0" on:submit={(e) => handleAdd(e, col.id)}>
          <!-- svelte-ignore a11y-autofocus -->
          <input
            class="w-full px-2 py-2 border border-accent rounded-lg text-[13px] outline-none bg-surface"
            bind:value={addInput}
            placeholder="Aufgabe..."
            autofocus
            on:keydown={(e) => { if (e.key === 'Escape') addingCol = null; }}
          />
          <div class="flex gap-2 justify-end">
            <button type="button" class="px-3 py-1 text-secondary rounded-lg text-[13px] hover:bg-gray-100 transition-colors" on:click={() => addingCol = null}>✕</button>
            <button type="submit" class="px-3 py-1 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-blue-600 transition-colors">+</button>
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
