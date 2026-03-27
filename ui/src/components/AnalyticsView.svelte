<script lang="ts">
  import { $tasks as tasksStore } from '../stores/taskStore';
  import { TAG_COLORS } from '../domain/types';

  $: tasks = $tasksStore;

  $: recent = (() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return tasks.filter(t => new Date(t.createdAt) >= sevenDaysAgo);
  })();

  $: tagMinutes = (() => {
    const m: Record<string, number> = {};
    for (const task of recent) {
      const tag = task.tags[0] ?? 'sonstige';
      m[tag] = (m[tag] ?? 0) + task.duration;
    }
    return m;
  })();

  $: total = Object.values(tagMinutes).reduce((s, v) => s + v, 0);
  $: sortedEntries = Object.entries(tagMinutes).sort((a, b) => b[1] - a[1]);
  $: done = recent.filter(t => t.status === 'done').length;
  $: completion = recent.length > 0 ? Math.round((done / recent.length) * 100) : 0;
</script>

<div class="overflow-y-auto p-6">
  <h2 class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted pb-4">Analytics</h2>

  <div class="flex flex-col gap-4">
    <div class="bg-surface rounded-2xl shadow-card border border-border p-5 flex flex-col gap-3">
      <span class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">Erledigungsrate (7 Tage)</span>
      <span class="text-[32px] font-bold text-primary">{completion}%</span>
      <div class="h-[6px] bg-border rounded-[3px] overflow-hidden">
        <div class="h-full bg-success rounded-[3px] transition-[width] duration-[600ms]" style="width:{completion}%" />
      </div>
    </div>

    <div class="bg-surface rounded-2xl shadow-card border border-border p-5 flex flex-col gap-3">
      <span class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">Zeit pro Kategorie</span>
      {#if sortedEntries.length === 0}
        <p class="text-[13px] text-muted">Noch keine Daten.</p>
      {/if}
      <ul class="list-none flex flex-col gap-2">
        {#each sortedEntries as [tag, minutes] (tag)}
          {@const pct = total > 0 ? (minutes / total) * 100 : 0}
          <li class="grid items-center gap-3" style="grid-template-columns: 70px 1fr 40px">
            <span class="text-[12px] text-secondary text-right overflow-hidden text-ellipsis whitespace-nowrap">{tag}</span>
            <div class="h-[10px] bg-border rounded-[5px] overflow-hidden">
              <div class="h-full rounded-[5px] transition-[width] duration-[600ms]" style="width:{pct}%; background:{TAG_COLORS[tag] ?? '#e5e7eb'}" />
            </div>
            <span class="text-[12px] text-muted text-right whitespace-nowrap">{Math.round(minutes / 60 * 10) / 10}h</span>
          </li>
        {/each}
      </ul>
    </div>
  </div>
</div>
