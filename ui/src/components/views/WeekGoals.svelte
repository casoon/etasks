<!-- @module:planning -->
<script lang="ts">
  import { $goals as goalsStore, addGoal, removeGoal, toggleGoalDay } from '../../stores/weeklyGoalStore';
  import { WEEKDAY_LABELS, longestStreak, weekDayKeys } from '../../lib/weekStats';

  export let weekStart: string;

  $: days = weekDayKeys(weekStart);
  $: goals = $goalsStore.filter((g) => g.weekStart === weekStart);

  let adding = false;
  let title = '';

  function dayName(key: string): string {
    return new Date(`${key}T00:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function submit() {
    const text = title.trim();
    if (!text) return;
    addGoal(text, weekStart);
    title = '';
    adding = false;
  }
</script>

<section aria-label="Wochenziele" class="et-card flex flex-col">
  <div class="flex items-center gap-2.5 px-4 pt-3.5 pb-2.5">
    <h2 class="et-h2 flex-1">Wochenziele</h2>
    <span class="text-[12px]" style="color:var(--et-text-3)">Tage anklicken, an denen du dran warst</span>
  </div>

  {#each goals as goal (goal.id)}
    {@const marked = (goal.daysCompleted ?? []).filter((d) => days.includes(d))}
    {@const streak = longestStreak(marked, days)}
    <div class="et-row flex flex-col gap-2.5 px-4 py-3">
      <div class="flex items-baseline gap-2">
        <span class="flex-1 font-semibold min-w-0 break-words">{goal.title}</span>
        <span class="text-[12px] whitespace-nowrap" style="color:var(--et-text-3)">{marked.length} / 7{streak >= 3 ? ` · ${streak} Tage in Folge` : ''}</span>
        <button
          class="et-btn et-btn-sm et-btn-icon et-btn-ghost self-center"
          aria-label="Ziel „{goal.title}“ löschen"
          on:click={() => removeGoal(goal.id)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"></path></svg>
        </button>
      </div>
      <div class="flex gap-1.5">
        {#each days as key, i (key)}
          {@const on = marked.includes(key)}
          <button
            class="flex-1 h-9 flex items-center justify-center gap-0.5 rounded-lg border text-[12px] font-semibold"
            style="border-color:{on ? 'var(--et-success)' : 'var(--et-border-strong)'};background:{on ? 'var(--et-success)' : 'var(--et-surface)'};color:{on ? '#fff' : 'var(--et-text-2)'}"
            aria-pressed={on}
            aria-label="{goal.title}: {dayName(key)}"
            on:click={() => toggleGoalDay(goal.id, key)}
          >
            {WEEKDAY_LABELS[i]}
            {#if on}<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg>{/if}
          </button>
        {/each}
      </div>
    </div>
  {/each}

  {#if goals.length === 0 && !adding}
    <p class="et-row px-4 py-3 text-[13px]" style="color:var(--et-text-3)">Noch kein Ziel für diese Woche.</p>
  {/if}

  <div class="et-row px-4 pt-2.5 pb-3.5">
    {#if adding}
      <form class="flex flex-wrap items-end gap-2" on:submit|preventDefault={submit}>
        <div class="flex-1 min-w-[180px] flex flex-col gap-1">
          <label class="et-label" for="goal-title">Neues Wochenziel</label>
          <!-- svelte-ignore a11y-autofocus -->
          <input
            id="goal-title"
            class="et-field"
            bind:value={title}
            autofocus
            on:keydown={(e) => { if (e.key === 'Escape') adding = false; }}
          />
        </div>
        <button type="submit" class="et-btn et-btn-primary" disabled={!title.trim()}>Hinzufügen</button>
        <button type="button" class="et-btn" on:click={() => (adding = false)}>Abbrechen</button>
      </form>
    {:else}
      <button
        class="w-full h-11 rounded-[10px] border border-dashed font-medium transition-colors hover:bg-[var(--et-surface-sunken)]"
        style="border-color:var(--et-border-control);color:var(--et-text-2)"
        on:click={() => { adding = true; title = ''; }}
      >+ Ziel für diese Woche</button>
    {/if}
  </div>
</section>
