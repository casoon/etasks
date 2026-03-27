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

<div class="flex flex-col border-r border-border overflow-hidden min-w-0">
  <div class="flex items-center gap-2 px-4 pt-4 pb-3 flex-shrink-0">
    <h2 class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted whitespace-nowrap overflow-hidden text-ellipsis">Aufgaben</h2>
    <span class="text-[11px] text-muted bg-bg px-[7px] py-[1px] rounded-[10px] flex-shrink-0">{tasks.length}</span>
  </div>

  <div class="h-[3px] bg-border mx-4 mb-3 rounded-sm overflow-hidden flex-shrink-0" title="{completionRate}% erledigt">
    <div class="h-full bg-success rounded-sm transition-[width] duration-[400ms]" style="width:{completionRate}%" />
  </div>

  <div class="flex-1 overflow-y-auto px-2 flex flex-col gap-[1px]">
    {#if tasks.length === 0}
      <p class="py-6 px-3 text-muted text-[13px] text-center leading-relaxed">Keine Aufgaben für heute. Füge eine hinzu!</p>
    {/if}
    {#each tasks as task (task.id)}
      <TaskCard {task} onDragStart={handleDragStart} />
    {/each}
  </div>

  {#if showInput}
    <form class="px-3 py-3 flex flex-col gap-2 flex-shrink-0 border-t border-border-subtle" on:submit={handleAdd}>
      <input
        bind:this={inputEl}
        class="w-full px-3 py-2 border border-border rounded-lg text-[13px] outline-none bg-bg focus:border-accent focus:bg-surface"
        bind:value={inputValue}
        placeholder="Neue Aufgabe..."
        on:keydown={(e) => { if (e.key === 'Escape') showInput = false; }}
      />
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="flex gap-2 flex-wrap min-w-0">
          <select class="border border-border rounded-md px-2 py-[2px] text-[12px] bg-bg outline-none max-w-[120px]" bind:value={duration}>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>1 h</option>
            <option value={90}>1,5 h</option>
            <option value={120}>2 h</option>
          </select>
          {#if activeProjects.length > 0}
            <select class="border border-border rounded-md px-2 py-[2px] text-[12px] bg-bg outline-none max-w-[120px]" bind:value={selectedProjectId}>
              <option value="">Kein Projekt</option>
              {#each activeProjects as p (p.id)}
                <option value={p.id}>{p.name}</option>
              {/each}
            </select>
          {/if}
        </div>
        <div class="flex gap-2 flex-shrink-0">
          <button type="button" class="px-3 py-1 text-secondary rounded-lg text-[13px] hover:bg-gray-100 transition-colors whitespace-nowrap" on:click={() => showInput = false}>✕</button>
          <button type="submit" class="px-3 py-1 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-blue-600 transition-colors whitespace-nowrap">Hinzufügen</button>
        </div>
      </div>
    </form>
  {:else}
    <button
      class="flex items-center gap-2 px-4 py-3 text-muted text-[13px] transition-colors hover:text-primary flex-shrink-0"
      on:click={() => showInput = true}
    >
      <span>+</span> Aufgabe hinzufügen
    </button>
  {/if}
</div>
