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

<div class="analytics-view">
  <h2 class="column-title" style="padding: 0 0 16px">Analytics</h2>

  <div class="analytics-grid">
    <div class="analytics-card card">
      <span class="analytics-label">Erledigungsrate (7 Tage)</span>
      <span class="analytics-value">{completion}%</span>
      <div class="analytics-bar-bg">
        <div class="analytics-bar-fill" style="width:{completion}%" />
      </div>
    </div>

    <div class="analytics-card card">
      <span class="analytics-label">Zeit pro Kategorie</span>
      {#if sortedEntries.length === 0}
        <p class="analytics-empty">Noch keine Daten.</p>
      {/if}
      <ul class="tag-chart">
        {#each sortedEntries as [tag, minutes] (tag)}
          {@const pct = total > 0 ? (minutes / total) * 100 : 0}
          <li class="tag-chart-row">
            <span class="tag-chart-label">{tag}</span>
            <div class="tag-chart-bar-bg">
              <div class="tag-chart-bar-fill" style="width:{pct}%; background:{TAG_COLORS[tag] ?? '#e5e7eb'}" />
            </div>
            <span class="tag-chart-value">{Math.round(minutes / 60 * 10) / 10}h</span>
          </li>
        {/each}
      </ul>
    </div>
  </div>
</div>
