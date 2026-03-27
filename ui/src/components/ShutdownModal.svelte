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
<div
  class="fixed inset-0 bg-black/30 flex items-center justify-center z-[1000] backdrop-blur-sm"
  on:click={(e) => { if (e.target === e.currentTarget) handleClose(); }}
>
  <div class="bg-surface rounded-2xl shadow-overlay w-full max-w-[560px] p-8 flex flex-col gap-6 max-h-[80vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="shutdown-title">
    <div>
      <h2 id="shutdown-title" class="text-lg font-semibold text-primary">Tagesabschluss</h2>
    </div>

    {#if openTasks.length > 0}
      <section class="flex flex-col gap-3">
        <h3 class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">Offene Aufgaben</h3>
        <ul class="list-none flex flex-col gap-2">
          {#each openTasks as task (task.id)}
            <li class="flex items-center justify-between gap-3 py-2 border-b border-border-subtle min-w-0">
              <span class="text-[13px] text-primary overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0">{task.title}</span>
              <button
                class="px-3 py-1 text-secondary rounded-lg text-[13px] hover:bg-gray-100 transition-colors whitespace-nowrap flex-shrink-0"
                on:click={() => handlePostpone(task.id)}
              >→ morgen</button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <section class="flex flex-col gap-3">
      <h3 class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">Highlight des Tages</h3>
      <textarea
        class="w-full px-3 py-3 border border-border rounded-lg text-[13px] resize-y outline-none bg-bg leading-relaxed focus:border-accent"
        bind:value={highlight}
        placeholder="Was war heute besonders gut?"
        rows={3}
      />
    </section>

    <div class="flex justify-end">
      <button
        class="px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
        on:click={handleClose}
      >Tag abschließen ✓</button>
    </div>
  </div>
</div>
{/if}
