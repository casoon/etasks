<script lang="ts">
  import { onMount } from 'svelte';
  import type { Task } from '../domain/types';
  import { $todayTasks as todayTasksStore, $completionRate as completionRateStore, addTask } from '../stores/taskStore';
  import { $projects as projectsStore } from '../stores/projectStore';
  import { dropTaskOnCalendar } from '../stores/calendarStore';
  import { snapToGrid } from '../domain/calendarService';
  import TaskCard from './TaskCard.svelte';

  $: tasks = $todayTasksStore;
  $: completionRate = $completionRateStore;
  $: projects = $projectsStore;

  let inputValue = '';
  let duration = 30;
  let selectedProjectId = '';
  let showInput = false;
  let inputEl: HTMLInputElement;

  $: if (showInput) setTimeout(() => inputEl?.focus(), 0);

  function handleAdd(e: Event) {
    e.preventDefault();
    const title = inputValue.trim();
    if (!title) return;
    addTask(title, duration, [], selectedProjectId || undefined);
    inputValue = '';
    duration = 30;
    showInput = false;
  }

  function handleDragStart(task: Task, e: PointerEvent) {
    const ghost = document.createElement('div');
    ghost.textContent = task.title;
    ghost.style.cssText = `position:fixed;pointer-events:none;z-index:9999;background:var(--color-accent);color:white;padding:6px 12px;border-radius:8px;font-size:13px;opacity:.9;transform:translate(-50%,-50%);left:${e.clientX}px;top:${e.clientY}px;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
    document.body.appendChild(ghost);

    function onMove(ev: PointerEvent) {
      ghost.style.left = `${ev.clientX}px`;
      ghost.style.top = `${ev.clientY}px`;
    }
    function onUp(ev: PointerEvent) {
      ghost.remove();
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const slot = el?.closest('[data-time-slot]') as HTMLElement | null;
      if (slot) dropTaskOnCalendar(task, snapToGrid(new Date(slot.dataset.timeSlot!)));
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  $: activeProjects = projects.filter(p => p.status === 'active');
</script>

<div class="task-column">
  <div class="task-column-header">
    <h2 class="column-title">Aufgaben</h2>
    <span class="task-count">{tasks.length}</span>
  </div>

  <div class="progress-bar-wrap" title="{completionRate}% erledigt">
    <div class="progress-bar-fill" style="width:{completionRate}%" />
  </div>

  <div class="task-list">
    {#if tasks.length === 0}
      <p class="task-empty">Keine Aufgaben für heute. Füge eine hinzu!</p>
    {/if}
    {#each tasks as task (task.id)}
      <TaskCard {task} onDragStart={handleDragStart} />
    {/each}
  </div>

  {#if showInput}
    <form class="add-task-form" on:submit={handleAdd}>
      <input
        bind:this={inputEl}
        class="add-task-input"
        bind:value={inputValue}
        placeholder="Neue Aufgabe..."
        on:keydown={(e) => { if (e.key === 'Escape') showInput = false; }}
      />
      <div class="add-task-meta">
        <div class="add-task-selects">
          <select class="duration-select" bind:value={duration}>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>1 h</option>
            <option value={90}>1,5 h</option>
            <option value={120}>2 h</option>
          </select>
          {#if activeProjects.length > 0}
            <select class="duration-select" bind:value={selectedProjectId}>
              <option value="">Kein Projekt</option>
              {#each activeProjects as p (p.id)}
                <option value={p.id}>{p.name}</option>
              {/each}
            </select>
          {/if}
        </div>
        <div class="add-task-buttons">
          <button type="button" class="btn-ghost" on:click={() => showInput = false}>✕</button>
          <button type="submit" class="btn-primary">Hinzufügen</button>
        </div>
      </div>
    </form>
  {:else}
    <button class="add-task-trigger" on:click={() => showInput = true}>
      <span>+</span> Aufgabe hinzufügen
    </button>
  {/if}
</div>
