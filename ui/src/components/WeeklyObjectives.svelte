<script lang="ts">
  import { $currentWeekGoals as goalsStore, addGoal, toggleGoal, removeGoal } from '../stores/weeklyGoalStore';

  $: goals = $goalsStore;
  let inputValue = '';
  let adding = false;

  function handleAdd(e: Event) {
    e.preventDefault();
    const title = inputValue.trim();
    if (!title) return;
    addGoal(title);
    inputValue = '';
    adding = false;
  }
</script>

<div class="weekly-objectives card">
  <div class="wo-header">
    <h3 class="wo-title">Wochenziele</h3>
    {#if goals.length < 5}
      <button class="wo-add-btn" on:click={() => adding = true} aria-label="Ziel hinzufügen">+</button>
    {/if}
  </div>

  <ul class="wo-list">
    {#each goals as goal (goal.id)}
      <li class="wo-item {goal.done ? 'wo-item--done' : ''}">
        <button class="wo-check" on:click={() => toggleGoal(goal.id)} aria-label="Ziel abhaken">
          {goal.done ? '✓' : '○'}
        </button>
        <span class="wo-label">{goal.title}</span>
        <button class="wo-remove" on:click={() => removeGoal(goal.id)} aria-label="Ziel entfernen">×</button>
      </li>
    {/each}
    {#if goals.length === 0 && !adding}
      <li class="wo-empty">Noch keine Ziele für diese Woche.</li>
    {/if}
  </ul>

  {#if adding}
    <form class="wo-form" on:submit={handleAdd}>
      <!-- svelte-ignore a11y-autofocus -->
      <input
        class="wo-input"
        bind:value={inputValue}
        placeholder="Wochenziel..."
        autofocus
        on:keydown={(e) => { if (e.key === 'Escape') adding = false; }}
      />
      <div class="wo-form-buttons">
        <button type="button" class="btn-ghost" on:click={() => adding = false}>Abbrechen</button>
        <button type="submit" class="btn-primary">Speichern</button>
      </div>
    </form>
  {/if}
</div>
