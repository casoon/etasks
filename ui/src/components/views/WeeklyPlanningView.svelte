<!-- @module:planning -->
<script lang="ts">
  import { $currentWeekPlan as currentWeekPlanStore, setFocusProjects, setOutcomeNote } from '../../stores/weekPlanStore';
  import { $projects as projectsStore } from '../../stores/projectStore';
  import { getWeekStart } from '../../domain/dateUtils';

  $: plan = $currentWeekPlanStore;
  $: projects = $projectsStore.filter(p => p.status !== 'done');

  const weekStart = getWeekStart(new Date());

  function weekLabel(ws: string): string {
    const d = new Date(ws + 'T00:00:00');
    const end = new Date(d);
    end.setDate(d.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
    const kw = getISOWeek(d);
    return `KW\u202f${kw} · ${fmt(d)}–${fmt(end)}`;
  }

  function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  function toggleProject(projectId: string) {
    const ids = plan.focusProjectIds ?? [];
    const next = ids.includes(projectId)
      ? ids.filter(id => id !== projectId)
      : [...ids, projectId];
    setFocusProjects(weekStart, next);
  }

  let noteDebounce: ReturnType<typeof setTimeout> | null = null;
  function handleNoteInput(e: Event) {
    const val = (e.target as HTMLTextAreaElement).value;
    if (noteDebounce) clearTimeout(noteDebounce);
    noteDebounce = setTimeout(() => setOutcomeNote(weekStart, val), 500);
  }
</script>

<div class="flex flex-col gap-6 p-5 overflow-y-auto">

  <div>
    <p class="text-[10px] font-bold uppercase tracking-[0.09em] text-muted mb-1">Woche</p>
    <p class="text-[14px] font-semibold text-primary">{weekLabel(weekStart)}</p>
  </div>

  <!-- Fokus-Projekte -->
  <div class="flex flex-col gap-2">
    <p class="text-[10px] font-bold uppercase tracking-[0.09em] text-muted">Fokus-Projekte</p>
    <p class="text-[12px] text-muted leading-relaxed">Welche Projekte sind diese Woche dran? Aufgaben dieser Projekte erscheinen im Tagesplanungs-Pool.</p>

    {#if projects.length === 0}
      <p class="text-[12px] text-muted italic">Noch keine Projekte vorhanden.</p>
    {:else}
      <div class="flex flex-col gap-1 mt-1">
        {#each projects as project (project.id)}
          {@const active = (plan.focusProjectIds ?? []).includes(project.id)}
          <button
            class="flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors text-left {active ? 'border-accent bg-accent-subtle' : 'border-border hover:border-border bg-bg hover:bg-surface'}"
            on:click={() => toggleProject(project.id)}
          >
            <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:{project.color}" />
            <span class="flex-1 text-[13px] {active ? 'text-accent font-medium' : 'text-primary'} overflow-hidden text-ellipsis whitespace-nowrap">{project.name}</span>
            {#if active}
              <span class="text-[11px] text-accent flex-shrink-0">✓</span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Outcome-Notiz -->
  <div class="flex flex-col gap-2">
    <p class="text-[10px] font-bold uppercase tracking-[0.09em] text-muted">Was soll diese Woche fertig sein?</p>
    <textarea
      class="w-full px-3 py-2.5 border border-border rounded-lg text-[13px] leading-relaxed resize-none outline-none bg-bg text-primary focus:border-accent focus:bg-surface transition-colors"
      rows={4}
      value={plan.outcomeNote ?? ''}
      on:input={handleNoteInput}
      placeholder="z.B. Angebot für Kunde X fertig, Login-Flow implementiert, …"
    />
  </div>

</div>