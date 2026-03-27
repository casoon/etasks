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
    const last = [...all].sort((a, b) => (b.sortOrder ?? 0) - (a.sortOrder ?? 0))[0];
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

<div class="flex flex-col gap-3 py-3">
  <div class="flex items-center justify-between mb-2">
    <h3 class="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">Wiederkehrende Aufgaben</h3>
    <button
      class="w-6 h-6 flex items-center justify-center rounded-lg text-muted text-lg hover:bg-bg hover:text-primary transition-colors flex-shrink-0"
      on:click={() => adding = true}
    >+</button>
  </div>

  <div class="flex flex-col gap-1">
    {#if recurring.length === 0 && !adding}
      <p class="text-[12px] text-muted text-center py-4">Noch keine Wiederholungen konfiguriert.</p>
    {/if}

    {#each recurring as task (task.id)}
      {@const project = task.projectId ? projects.find(p => p.id === task.projectId) : null}
      <div class="group flex items-center gap-2 px-2 py-2 rounded-lg transition-colors hover:bg-bg">
        {#if project}<span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{project.color}" />{/if}
        <div class="flex-1 min-w-0 flex flex-col gap-[1px]">
          <span class="text-[13px] text-primary min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{task.title}</span>
          <span class="text-[11px] text-muted">{scheduleLabel(task)}</span>
        </div>
        <button
          class="text-base text-muted px-[2px] leading-none transition-colors hover:text-red-500"
          on:click={() => removeTask(task.id)}
          aria-label="Löschen"
        >×</button>
      </div>
    {/each}
  </div>

  {#if adding}
    <form class="flex flex-col gap-2 p-3 bg-bg rounded-lg border border-border mt-2" on:submit={handleAdd}>
      <!-- svelte-ignore a11y-autofocus -->
      <input
        class="w-full px-3 py-2 border border-border rounded-lg text-[13px] outline-none bg-surface focus:border-accent"
        bind:value={title}
        placeholder="Aufgabentitel..."
        autofocus
      />
      <div class="flex gap-2 flex-wrap">
        <select class="border border-border rounded-md px-2 py-[2px] text-[12px] bg-bg outline-none max-w-[120px]" bind:value={freq}>
          <option value="daily">Täglich</option>
          <option value="weekly">Wöchentlich</option>
          <option value="monthly">Monatlich</option>
        </select>
        {#if freq === 'weekly'}
          <select class="border border-border rounded-md px-2 py-[2px] text-[12px] bg-bg outline-none max-w-[120px]" bind:value={dayOfWeek}>
            {#each WEEKDAYS as d, i (i)}
              <option value={i}>{d}</option>
            {/each}
          </select>
        {/if}
        {#if freq === 'monthly'}
          <input
            class="border border-border rounded-md px-2 py-[2px] text-[12px] bg-bg outline-none w-[60px]"
            type="number" min={1} max={28}
            bind:value={dayOfMonth}
          />
        {/if}
        <select class="border border-border rounded-md px-2 py-[2px] text-[12px] bg-bg outline-none max-w-[120px]" bind:value={duration}>
          <option value={15}>15 min</option>
          <option value={30}>30 min</option>
          <option value={60}>1 h</option>
        </select>
        {#if projects.filter(p => p.status === 'active').length > 0}
          <select class="border border-border rounded-md px-2 py-[2px] text-[12px] bg-bg outline-none max-w-[120px]" bind:value={projectId}>
            <option value="">Kein Projekt</option>
            {#each projects.filter(p => p.status === 'active') as p (p.id)}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>
        {/if}
      </div>
      <div class="flex gap-2">
        <button type="button" class="px-3 py-1 text-secondary rounded-lg text-[13px] hover:bg-gray-100 transition-colors" on:click={() => adding = false}>Abbrechen</button>
        <button type="submit" class="px-3 py-1 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-blue-600 transition-colors">Speichern</button>
      </div>
    </form>
  {/if}
</div>
