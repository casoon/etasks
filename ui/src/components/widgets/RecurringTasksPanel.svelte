<!-- @core -->
<script lang="ts">
  import { $tasks as tasksStore, addTask, updateTask, removeTask } from '../../stores/taskStore';
  import { $projects as projectsStore } from '../../stores/projectStore';
  import { isRecurringDueOn } from '../../domain/dateUtils';
  import { today } from '../../domain/dateUtils';
  import type { RecurrenceRule } from '../../domain/types';

  const DAYS = [
    { label: 'Mo', value: 1 },
    { label: 'Di', value: 2 },
    { label: 'Mi', value: 3 },
    { label: 'Do', value: 4 },
    { label: 'Fr', value: 5 },
    { label: 'Sa', value: 6 },
    { label: 'So', value: 0 },
  ];

  $: tasks = $tasksStore;
  $: projects = $projectsStore;
  $: recurring = tasks.filter(t => t.recurrence && !t.sourceTaskId);

  let adding = false;
  let title = '';
  let weekdays: number[] = [1, 2, 3, 4, 5]; // Mo–Fr default
  let startDate = today();
  let endDate = '';
  let duration = 30;
  let projectId = '';

  function toggleDay(val: number) {
    weekdays = weekdays.includes(val) ? weekdays.filter(d => d !== val) : [...weekdays, val];
  }

  function handleAdd(e: Event) {
    e.preventDefault();
    if (!title.trim() || weekdays.length === 0) return;
    const rule: RecurrenceRule = {
      weekdays,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };
    addTask(title.trim(), duration, [], projectId || undefined);
    const all = tasksStore.get();
    const last = [...all].reverse().find(t => !t.recurrence && !t.sourceTaskId);
    if (last) updateTask(last.id, { recurrence: rule, plannedDate: null });

    title = ''; weekdays = [1, 2, 3, 4, 5]; endDate = ''; adding = false;
  }

  function ruleLabel(rule: RecurrenceRule): string {
    const effective = rule.weekdays?.length > 0 ? rule.weekdays : legacyWeekdays(rule);
    const sorted = [...effective].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
    const names = sorted.map(d => DAYS.find(x => x.value === d)?.label ?? '');
    const range = rule.endDate ? ` bis ${rule.endDate.slice(5).replace('-', '.')}` : '';
    return names.join(', ') + range;
  }

  function legacyWeekdays(rule: RecurrenceRule): number[] {
    if (rule.frequency === 'daily') return [1,2,3,4,5];
    if (rule.frequency === 'weekly' && rule.dayOfWeek !== undefined) return [rule.dayOfWeek];
    return [];
  }

  const todayStr = today();
  function isDueToday(rule: RecurrenceRule): boolean {
    return isRecurringDueOn(rule, todayStr);
  }
</script>

<div class="flex flex-col gap-1">
  {#if recurring.length === 0 && !adding}
    <div class="text-[12px] text-muted text-center py-6 leading-relaxed flex flex-col gap-2">
      <span>Noch keine Wiederholungen.</span>
      <button class="text-accent hover:underline" on:click={() => adding = true}>+ Erste anlegen</button>
    </div>
  {/if}

  {#each recurring as task (task.id)}
    {@const project = task.projectId ? projects.find(p => p.id === task.projectId) : null}
    {@const due = task.recurrence ? isDueToday(task.recurrence) : false}
    <div class="group flex items-center gap-2 px-2 py-2 rounded-lg transition-colors hover:bg-bg/80">
      {#if project}<span class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background:{project.color}" />{/if}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5">
          <span class="text-[12px] text-primary truncate">{task.title}</span>
          {#if due}<span class="text-[10px] text-accent font-medium flex-shrink-0">heute</span>{/if}
        </div>
        <span class="text-[10px] text-muted">{task.recurrence ? ruleLabel(task.recurrence) : ''}</span>
      </div>
      <button
        class="text-sm text-muted/50 px-[2px] leading-none hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
        on:click={() => removeTask(task.id)}
        aria-label="Löschen"
      >×</button>
    </div>
  {/each}

  {#if adding}
    <form class="flex flex-col gap-2 p-3 bg-bg rounded-lg border border-accent/30 mt-1" on:submit={handleAdd}>
      <!-- svelte-ignore a11y-autofocus -->
      <input
        class="w-full px-2 py-1.5 border border-border rounded-lg text-[13px] outline-none bg-surface focus:border-accent"
        bind:value={title}
        placeholder="Aufgabentitel..."
        autofocus
      />

      <!-- Weekday toggles -->
      <div class="flex gap-1 flex-wrap">
        {#each DAYS as d (d.value)}
          <button
            type="button"
            class="px-2 py-1 rounded-md text-[11px] font-medium transition-colors {weekdays.includes(d.value) ? 'bg-accent text-white' : 'bg-border text-muted hover:bg-border-strong'}"
            on:click={() => toggleDay(d.value)}
          >{d.label}</button>
        {/each}
      </div>

      <!-- Date range + duration -->
      <div class="flex gap-2 flex-wrap items-center">
        <label class="flex items-center gap-1 text-[11px] text-muted">
          Ab <input type="date" class="border border-border rounded px-1 py-0.5 text-[11px] bg-bg outline-none" bind:value={startDate} />
        </label>
        <label class="flex items-center gap-1 text-[11px] text-muted">
          Bis <input type="date" class="border border-border rounded px-1 py-0.5 text-[11px] bg-bg outline-none" bind:value={endDate} placeholder="(kein Ende)" />
        </label>
        <select class="border border-border rounded-md px-1.5 py-0.5 text-[11px] bg-bg outline-none ml-auto" bind:value={duration}>
          <option value={15}>15 min</option>
          <option value={30}>30 min</option>
          <option value={45}>45 min</option>
          <option value={60}>1 h</option>
          <option value={90}>1,5 h</option>
        </select>
      </div>

      {#if projects.filter(p => p.status === 'active').length > 0}
        <select class="border border-border rounded-md px-2 py-[3px] text-[12px] bg-bg outline-none" bind:value={projectId}>
          <option value="">Kein Projekt</option>
          {#each projects.filter(p => p.status === 'active') as p (p.id)}
            <option value={p.id}>{p.name}</option>
          {/each}
        </select>
      {/if}

      <div class="flex gap-2">
        <button type="submit" class="flex-1 px-3 py-1.5 bg-accent text-white rounded-lg text-[12px] font-medium hover:opacity-90 transition-opacity" disabled={weekdays.length === 0}>Speichern</button>
        <button type="button" class="px-3 py-1.5 text-secondary rounded-lg text-[12px] hover:bg-border transition-colors" on:click={() => adding = false}>Abbrechen</button>
      </div>
    </form>
  {:else}
    <button
      class="flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-muted hover:text-secondary transition-colors mt-1"
      on:click={() => adding = true}
    >+ Wiederholung hinzufügen</button>
  {/if}
</div>