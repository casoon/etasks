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
  class="task-card group flex items-center gap-2 px-2 py-[7px] rounded-lg cursor-grab transition-colors hover:bg-bg select-none min-w-0 {isDone ? 'task-card--done' : ''}"
  on:pointerdown={handlePointerDown}
  data-task-id={task.id}
>
  {#if project}
    <span class="w-[5px] h-[5px] rounded-full flex-shrink-0" style="background:{project.color}" title={project.name} />
  {/if}

  <button
    class="w-[18px] h-[18px] border-2 border-border rounded-full flex-shrink-0 flex items-center justify-center text-[10px] transition-colors hover:border-success {isDone ? 'border-success bg-success-subtle' : ''}"
    on:click={handleToggle}
    aria-label={isDone ? 'Als offen markieren' : 'Als erledigt markieren'}
  >
    <span class="{isDone ? 'text-success' : ''}">{isDone ? '✓' : ''}</span>
  </button>

  <div class="flex-1 min-w-0 flex flex-col gap-[3px]">
    {#if editing}
      <!-- svelte-ignore a11y-autofocus -->
      <input
        bind:value={editTitle}
        on:blur={saveEdit}
        on:keydown={handleEditKey}
        autofocus
        style="font-size:13px; border:1px solid var(--color-accent); border-radius:4px; padding:1px 4px; width:100%; outline:none;"
      />
      <select
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
      <span
        class="text-[13px] leading-[1.4] text-primary overflow-hidden text-ellipsis whitespace-nowrap max-w-full {isDone ? 'line-through text-muted' : ''}"
        on:dblclick={startEdit}
        title="Doppelklick zum Bearbeiten"
      >{task.title}</span>
      {#if task.tags.length > 0}
        <div class="flex flex-wrap gap-[3px]">
          {#each task.tags as tag (tag)}
            <span class="text-[10px] px-[5px] py-[1px] rounded text-primary whitespace-nowrap max-w-[80px] overflow-hidden text-ellipsis" style="background:{TAG_COLORS[tag] ?? '#e5e7eb'}">{tag}</span>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  <div class="flex items-center gap-[2px] flex-shrink-0">
    {#if task.recurrence}<RecurringBadge recurrence={task.recurrence} />{/if}
    {#if task.scheduledAt}<span class="w-[5px] h-[5px] rounded-full bg-accent flex-shrink-0" title="Eingeplant" />{/if}
    <span class="text-[11px] text-muted whitespace-nowrap">{formatDuration(task.duration)}</span>
    <TimerButton taskId={task.id} />
    <button
      class="opacity-0 group-hover:opacity-100 text-[12px] text-muted px-[2px] transition-opacity hover:text-accent leading-none"
      on:click={handleFocus}
      title="Fokus starten"
    >⏱</button>
    <button
      class="opacity-0 group-hover:opacity-100 text-[12px] text-muted px-[2px] transition-opacity hover:text-accent leading-none"
      on:click={startEdit}
      title="Bearbeiten"
    >✎</button>
    <button
      class="opacity-0 group-hover:opacity-100 text-base text-muted px-[2px] transition-opacity hover:text-primary leading-none"
      on:click={handleDelete}
      aria-label="Task löschen"
    >×</button>
  </div>
</div>
