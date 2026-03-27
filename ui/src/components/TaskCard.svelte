<script lang="ts">
  import type { Task } from '../domain/types';
  import { formatDuration } from '../domain/dateUtils';
  import { toggleTask, removeTask, updateTask } from '../stores/taskStore';
  import { removeBlockForTask } from '../stores/calendarStore';
  import { $focusTaskId as focusTaskIdStore, $navItem as navItemStore } from '../stores/uiStore';
  import { $projects as projectsStore } from '../stores/projectStore';
  import { TAG_COLORS } from '../domain/types';
  import TimerButton from './TimerButton.svelte';
  import RecurringBadge from './RecurringBadge.svelte';

  export let task: Task;
  export let onDragStart: ((task: Task, e: PointerEvent) => void) | undefined = undefined;

  $: isDone = task.status === 'done';
  $: projects = $projectsStore;
  $: project = task.projectId ? projects.find(p => p.id === task.projectId) : null;

  // Edit state
  let editing = false;
  let editTitle = '';
  let editDuration = 30;

  function startEdit() {
    editTitle = task.title;
    editDuration = task.duration;
    editing = true;
  }

  function saveEdit() {
    const t = editTitle.trim();
    if (t && (t !== task.title || editDuration !== task.duration)) {
      updateTask(task.id, { title: t, duration: editDuration });
    }
    editing = false;
  }

  function handleEditKey(e: KeyboardEvent) {
    if (e.key === 'Enter') { saveEdit(); }
    if (e.key === 'Escape') { editing = false; }
  }

  function handleToggle(e: MouseEvent) {
    e.stopPropagation();
    toggleTask(task.id);
  }

  function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    removeBlockForTask(task.id);
    removeTask(task.id);
  }

  function handleFocus(e: MouseEvent) {
    e.stopPropagation();
    focusTaskIdStore.set(task.id);
    navItemStore.set('focus');
  }

  function handlePointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('button, input, select')) return;
    if (editing) return;
    onDragStart?.(task, e);
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="task-card {isDone ? 'task-card--done' : ''}"
  on:pointerdown={handlePointerDown}
  data-task-id={task.id}
>
  {#if project}
    <span class="task-project-dot" style="background:{project.color}" title={project.name} />
  {/if}

  <button
    class="task-check"
    on:click={handleToggle}
    aria-label={isDone ? 'Als offen markieren' : 'Als erledigt markieren'}
  >
    <span class="check-icon {isDone ? 'check-icon--done' : ''}">{isDone ? '✓' : ''}</span>
  </button>

  <div class="task-body">
    {#if editing}
      <!-- svelte-ignore a11y-autofocus -->
      <input
        class="task-edit-input"
        bind:value={editTitle}
        on:blur={saveEdit}
        on:keydown={handleEditKey}
        autofocus
        style="font-size:13px; border:1px solid var(--color-accent); border-radius:4px; padding:1px 4px; width:100%; outline:none;"
      />
      <select
        class="duration-select"
        bind:value={editDuration}
        style="margin-top:3px; font-size:11px;"
        on:change={saveEdit}
      >
        <option value={15}>15 min</option>
        <option value={30}>30 min</option>
        <option value={45}>45 min</option>
        <option value={60}>1 h</option>
        <option value={90}>1,5 h</option>
        <option value={120}>2 h</option>
      </select>
    {:else}
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <span class="task-title" on:dblclick={startEdit} title="Doppelklick zum Bearbeiten">{task.title}</span>
      {#if task.tags.length > 0}
        <div class="task-tags">
          {#each task.tags as tag (tag)}
            <span class="tag" style="background:{TAG_COLORS[tag] ?? '#e5e7eb'}">{tag}</span>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  <div class="task-meta">
    {#if task.recurrence}<RecurringBadge recurrence={task.recurrence} />{/if}
    {#if task.scheduledAt}<span class="task-scheduled-dot" title="Eingeplant" />{/if}
    <span class="task-duration">{formatDuration(task.duration)}</span>
    <TimerButton taskId={task.id} />
    <button class="task-focus-btn" on:click={handleFocus} title="Fokus starten">⏱</button>
    <button class="task-edit-btn" on:click={startEdit} title="Bearbeiten">✎</button>
    <button class="task-delete" on:click={handleDelete} aria-label="Task löschen">×</button>
  </div>
</div>
