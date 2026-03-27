<script lang="ts">
  import { $tasks as tasksStore, addTask, updateTask, removeTask } from '../stores/taskStore';
  import { $projects as projectsStore } from '../stores/projectStore';
  import type { RecurrenceRule, RecurrenceFrequency } from '../domain/types';

  const FREQ_LABELS: Record<RecurrenceFrequency, string> = {
    daily: 'Täglich', weekly: 'Wöchentlich', monthly: 'Monatlich',
  };
  const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

  $: tasks = $tasksStore;
  $: projects = $projectsStore;
  $: recurring = tasks.filter(t => t.recurrence && !t.sourceTaskId);

  let adding = false;
  let title = '';
  let freq: RecurrenceFrequency = 'weekly';
  let dayOfWeek = 1;
  let dayOfMonth = 1;
  let duration = 30;
  let projectId = '';

  function handleAdd(e: Event) {
    e.preventDefault();
    if (!title.trim()) return;
    const rule: RecurrenceRule = { frequency: freq };
    if (freq === 'weekly') rule.dayOfWeek = dayOfWeek;
    if (freq === 'monthly') rule.dayOfMonth = dayOfMonth;

    addTask(title.trim(), duration, [], projectId || undefined);
    const all = tasksStore.get();
    const last = [...all].sort((a, b) => b.order - a.order)[0];
    if (last) updateTask(last.id, { recurrence: rule });

    title = ''; adding = false;
  }

  function scheduleLabel(t: typeof recurring[0]) {
    const rule = t.recurrence!;
    let s = FREQ_LABELS[rule.frequency];
    if (rule.frequency === 'weekly' && rule.dayOfWeek !== undefined) s += ` (${WEEKDAYS[rule.dayOfWeek]})`;
    if (rule.frequency === 'monthly' && rule.dayOfMonth) s += ` (${rule.dayOfMonth}.)`;
    return s;
  }
</script>

<div class="recurring-panel">
  <div class="recurring-header">
    <h3 class="recurring-title">Wiederkehrende Aufgaben</h3>
    <button class="icon-btn" on:click={() => adding = true}>+</button>
  </div>

  <div class="recurring-list">
    {#if recurring.length === 0 && !adding}
      <p class="recurring-empty">Noch keine Wiederholungen konfiguriert.</p>
    {/if}

    {#each recurring as task (task.id)}
      {@const project = task.projectId ? projects.find(p => p.id === task.projectId) : null}
      <div class="recurring-item">
        {#if project}<span class="recurring-dot" style="background:{project.color}" />{/if}
        <div class="recurring-info">
          <span class="recurring-item-title">{task.title}</span>
          <span class="recurring-item-schedule">{scheduleLabel(task)}</span>
        </div>
        <button class="task-delete" style="opacity:1" on:click={() => removeTask(task.id)} aria-label="Löschen">×</button>
      </div>
    {/each}
  </div>

  {#if adding}
    <form class="recurring-form" on:submit={handleAdd}>
      <!-- svelte-ignore a11y-autofocus -->
      <input class="add-task-input" bind:value={title} placeholder="Aufgabentitel..." autofocus />
      <div class="recurring-form-row">
        <select class="duration-select" bind:value={freq}>
          <option value="daily">Täglich</option>
          <option value="weekly">Wöchentlich</option>
          <option value="monthly">Monatlich</option>
        </select>
        {#if freq === 'weekly'}
          <select class="duration-select" bind:value={dayOfWeek}>
            {#each WEEKDAYS as d, i (i)}
              <option value={i}>{d}</option>
            {/each}
          </select>
        {/if}
        {#if freq === 'monthly'}
          <input class="duration-select" type="number" min={1} max={28} bind:value={dayOfMonth} style="width:60px" />
        {/if}
        <select class="duration-select" bind:value={duration}>
          <option value={15}>15 min</option>
          <option value={30}>30 min</option>
          <option value={60}>1 h</option>
        </select>
        {#if projects.filter(p => p.status === 'active').length > 0}
          <select class="duration-select" bind:value={projectId}>
            <option value="">Kein Projekt</option>
            {#each projects.filter(p => p.status === 'active') as p (p.id)}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>
        {/if}
      </div>
      <div class="add-task-buttons">
        <button type="button" class="btn-ghost" on:click={() => adding = false}>Abbrechen</button>
        <button type="submit" class="btn-primary">Speichern</button>
      </div>
    </form>
  {/if}
</div>
