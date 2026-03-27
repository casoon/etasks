<script lang="ts">
  import { $showShutdown as showStore } from '../stores/uiStore';
  import { $todayTasks as todayTasksStore, updateTask } from '../stores/taskStore';
  import { today } from '../domain/dateUtils';
  import { upsertNote } from '../lib/db';

  $: show = $showStore;
  $: tasks = $todayTasksStore;
  $: openTasks = tasks.filter(t => t.status === 'todo');

  let highlight = '';

  function handlePostpone(id: string) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    updateTask(id, { date: tomorrow.toISOString().slice(0, 10), scheduledAt: undefined });
  }

  function handleClose() {
    if (highlight.trim()) {
      upsertNote({ date: today(), highlight: highlight.trim(), createdAt: new Date().toISOString() });
    }
    showStore.set(false);
    highlight = '';
  }
</script>

{#if show}
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="modal-overlay" on:click={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
  <div class="modal card" role="dialog" aria-modal="true" aria-labelledby="shutdown-title">
    <div class="modal-header">
      <h2 id="shutdown-title" class="modal-title">Tagesabschluss</h2>
    </div>

    {#if openTasks.length > 0}
      <section class="shutdown-section">
        <h3 class="shutdown-section-title">Offene Aufgaben</h3>
        <ul class="shutdown-task-list">
          {#each openTasks as task (task.id)}
            <li class="shutdown-task">
              <span class="shutdown-task-title">{task.title}</span>
              <button class="btn-ghost" on:click={() => handlePostpone(task.id)}>→ morgen</button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <section class="shutdown-section">
      <h3 class="shutdown-section-title">Highlight des Tages</h3>
      <textarea
        class="shutdown-highlight"
        bind:value={highlight}
        placeholder="Was war heute besonders gut?"
        rows={3}
      />
    </section>

    <div class="modal-footer">
      <button class="btn-primary" on:click={handleClose}>Tag abschließen ✓</button>
    </div>
  </div>
</div>
{/if}
