<script lang="ts">
  import { $currentWeekGoals as goalsStore, addGoal, toggleGoal, removeGoal, toggleGoalDay } from '../stores/weeklyGoalStore';
  import { getWeekStart, today } from '../domain/dateUtils';

  $: goals = $goalsStore;
  let inputValue = '';
  let adding = false;

  const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const weekStart = getWeekStart(new Date());
  const todayStr = today();

  function getWeekDates(ws: string): string[] {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ws);
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
  }

  const weekDates = getWeekDates(weekStart);

  function handleAdd(e: Event) {
    e.preventDefault();
    const title = inputValue.trim();
    if (!title) return;
    addGoal(title);
    inputValue = '';
    adding = false;
  }
</script>

<div class="bg-surface rounded-2xl shadow-card border border-border p-4 min-w-0">
  <div class="flex items-center justify-between mb-3 gap-2">
    <h3 class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted whitespace-nowrap overflow-hidden text-ellipsis">Wochenziele</h3>
    {#if goals.length < 5}
      <button
        class="w-5 h-5 rounded-full bg-bg text-secondary text-base flex items-center justify-center leading-none transition-colors hover:bg-border flex-shrink-0"
        on:click={() => adding = true}
        aria-label="Ziel hinzufügen"
      >+</button>
    {/if}
  </div>

  <ul class="list-none flex flex-col gap-[2px]">
    {#each goals as goal (goal.id)}
      <li class="group flex flex-col gap-[2px] py-[5px] min-w-0">
        <div class="flex items-center gap-2 min-w-0">
          <button
            class="text-[13px] w-4 text-center flex-shrink-0 transition-colors {goal.done ? 'text-success' : 'text-muted'}"
            on:click={() => toggleGoal(goal.id)}
            aria-label="Ziel abhaken"
          >
            {goal.done ? '✓' : '○'}
          </button>
          <span class="flex-1 text-[13px] text-primary overflow-hidden text-ellipsis whitespace-nowrap min-w-0 {goal.done ? 'line-through text-muted' : ''}">{goal.title}</span>
          <button
            class="opacity-0 group-hover:opacity-100 text-sm text-muted transition-opacity flex-shrink-0"
            on:click={() => removeGoal(goal.id)}
            aria-label="Ziel entfernen"
          >×</button>
        </div>
        <div class="flex items-center gap-[5px] pl-6">
          {#each weekDates as date, i}
            {@const done = (goal.daysCompleted ?? []).includes(date)}
            {@const isToday = date === todayStr}
            <button
              class="flex flex-col items-center gap-[1px] group/dot"
              on:click={() => toggleGoalDay(goal.id, date)}
              aria-label="{DAY_LABELS[i]} {done ? 'abhaken' : 'markieren'}"
              title="{DAY_LABELS[i]}"
            >
              <div
                class="w-3 h-3 rounded-full transition-colors {done ? 'bg-accent' : 'bg-transparent border border-border group-hover/dot:border-accent'} {isToday ? 'ring-1 ring-accent ring-offset-1 ring-offset-surface' : ''}"
              ></div>
              <span class="text-[8px] text-muted leading-none">{DAY_LABELS[i]}</span>
            </button>
          {/each}
        </div>
      </li>
    {/each}
    {#if goals.length === 0 && !adding}
      <li class="text-[12px] text-muted py-2 leading-relaxed">Noch keine Ziele für diese Woche.</li>
    {/if}
  </ul>

  {#if adding}
    <form class="flex flex-col gap-2 mt-2" on:submit={handleAdd}>
      <!-- svelte-ignore a11y-autofocus -->
      <input
        class="w-full px-3 py-2 border border-border rounded-lg text-[13px] bg-bg outline-none focus:border-accent"
        bind:value={inputValue}
        placeholder="Wochenziel..."
        autofocus
        on:keydown={(e) => { if (e.key === 'Escape') adding = false; }}
      />
      <div class="flex gap-2 justify-end">
        <button type="button" class="px-3 py-1 text-secondary rounded-lg text-[13px] hover:bg-gray-100 transition-colors" on:click={() => adding = false}>Abbrechen</button>
        <button type="submit" class="px-3 py-1 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-blue-600 transition-colors">Speichern</button>
      </div>
    </form>
  {/if}
</div>
