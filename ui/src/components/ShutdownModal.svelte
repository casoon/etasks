<script lang="ts">
  import { $showShutdown as showStore } from '../stores/uiStore';
  import { $todayTasks as todayTasksStore, updateTask } from '../stores/taskStore';
  import { today } from '../domain/dateUtils';
  import { upsertNote, loadTimeEntries, loadProjects } from '../lib/db';

  $: show = $showStore;
  $: tasks = $todayTasksStore;
  $: openTasks = tasks.filter(t => t.status === 'todo');
  $: doneTasks = tasks.filter(t => t.status === 'done');

  let highlight = '';
  let showSummary = false;

  interface ProjectTime { name: string; color: string; minutes: number }

  function buildSummary(): { totalMinutes: number; completionRate: number; byProject: ProjectTime[] } {
    const todayStr = today();
    const entries = loadTimeEntries().filter(e => e.date === todayStr);
    const projects = loadProjects();
    const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));

    const byProject: Record<string, ProjectTime> = {};
    let totalMinutes = 0;
    for (const e of entries) {
      const mins = e.durationMinutes ?? 0;
      totalMinutes += mins;
      const p = projectMap[e.projectId];
      if (!p) continue;
      if (!byProject[p.id]) byProject[p.id] = { name: p.name, color: p.color ?? '#6366f1', minutes: 0 };
      byProject[p.id].minutes += mins;
    }

    const all = tasks.length;
    const done = doneTasks.length;
    const completionRate = all === 0 ? 0 : Math.round((done / all) * 100);

    return {
      totalMinutes,
      completionRate,
      byProject: Object.values(byProject).sort((a, b) => b.minutes - a.minutes),
    };
  }

  function fmtDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} h`;
    return `${h} h ${m} min`;
  }

  function completionLabel(rate: number): string {
    if (rate === 100) return 'Alle Aufgaben erledigt';
    if (rate >= 75) return 'Sehr produktiver Tag';
    if (rate >= 50) return 'Solider Fortschritt';
    if (rate >= 25) return 'Ein paar Aufgaben erledigt';
    return 'Tag mit Potenzial nach oben';
  }

  function handlePostpone(id: string) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    updateTask(id, { plannedDate: tomorrow.toISOString().slice(0, 10), scheduledStart: null });
  }

  function handleClose() {
    if (highlight.trim()) {
      upsertNote({ date: today(), highlight: highlight.trim(), createdAt: new Date().toISOString() });
    }
    showStore.set(false);
    highlight = '';
    showSummary = false;
  }

  $: summary = show ? buildSummary() : null;
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

    {#if summary}
      <!-- Tages-Zusammenfassung -->
      <section class="flex flex-col gap-3">
        <h3 class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">Heute</h3>
        <div class="flex gap-3">
          <!-- Fortschrittsring -->
          <div class="relative flex-shrink-0 w-16 h-16">
            <svg viewBox="0 0 36 36" class="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--color-border)" stroke-width="3" />
              <circle
                cx="18" cy="18" r="15.9"
                fill="none"
                stroke="var(--color-accent, #6366f1)"
                stroke-width="3"
                stroke-dasharray="{summary.completionRate} {100 - summary.completionRate}"
                stroke-linecap="round"
              />
            </svg>
            <span class="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-primary">{summary.completionRate}%</span>
          </div>
          <div class="flex flex-col justify-center gap-1">
            <p class="text-[13px] font-semibold text-primary">{completionLabel(summary.completionRate)}</p>
            <p class="text-[12px] text-secondary">
              {doneTasks.length} von {tasks.length} Aufgaben · {fmtDuration(summary.totalMinutes)} erfasst
            </p>
          </div>
        </div>

        {#if summary.byProject.length > 0}
          <div class="flex flex-col gap-1.5">
            {#each summary.byProject as p}
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:{p.color}"></span>
                <span class="text-[12px] text-secondary flex-1 truncate">{p.name}</span>
                <span class="text-[12px] text-muted tabular-nums">{fmtDuration(p.minutes)}</span>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {/if}

    {#if openTasks.length > 0}
      <section class="flex flex-col gap-3">
        <h3 class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">Offene Aufgaben</h3>
        <ul class="list-none flex flex-col gap-2">
          {#each openTasks as task (task.id)}
            <li class="flex items-center justify-between gap-3 py-2 border-b border-border-subtle min-w-0">
              <span class="text-[13px] text-primary overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0">{task.title}</span>
              <button
                class="px-3 py-1 text-secondary rounded-lg text-[13px] hover:bg-bg transition-colors whitespace-nowrap flex-shrink-0"
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
