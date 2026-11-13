<!-- @module:planning -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { $weekPlans as weekPlansStore, setFocusProjects, setOutcomeNote } from '../../stores/weekPlanStore';
  import { $projects as projectsStore } from '../../stores/projectStore';

  export let weekStart: string;

  $: plan = $weekPlansStore.find((p) => p.weekStart === weekStart) ?? { weekStart, focusProjectIds: [] as string[] };
  $: projects = $projectsStore.filter((p) => p.status !== 'done');

  function toggleProject(projectId: string) {
    const ids = plan.focusProjectIds ?? [];
    setFocusProjects(weekStart, ids.includes(projectId) ? ids.filter((id) => id !== projectId) : [...ids, projectId]);
  }

  let noteDebounce: ReturnType<typeof setTimeout> | null = null;
  let pendingNote: { week: string; value: string } | null = null;

  function flushNote() {
    if (noteDebounce) clearTimeout(noteDebounce);
    noteDebounce = null;
    if (!pendingNote) return;
    const { week, value } = pendingNote;
    pendingNote = null;
    setOutcomeNote(week, value);
  }

  function handleNoteInput(e: Event) {
    pendingNote = { week: weekStart, value: (e.target as HTMLTextAreaElement).value };
    if (noteDebounce) clearTimeout(noteDebounce);
    noteDebounce = setTimeout(flushNote, 500);
  }

  onDestroy(flushNote);
</script>

<section aria-label="Fokus-Projekte" class="et-card flex flex-col gap-3 px-4 pt-3.5 pb-4">
  <h2 class="et-h2">Fokus-Projekte</h2>
  {#if projects.length === 0}
    <p class="text-[13px]" style="color:var(--et-text-3)">Noch keine Projekte vorhanden.</p>
  {:else}
    <div class="flex flex-wrap gap-2">
      {#each projects as project (project.id)}
        {@const active = (plan.focusProjectIds ?? []).includes(project.id)}
        <button
          class="flex items-center gap-2 h-10 px-3 rounded-[20px] transition-colors {active ? 'font-semibold' : 'font-medium hover:bg-[var(--et-surface-sunken)]'}"
          style="border:{active ? '1.5px solid var(--et-accent)' : '1px solid var(--et-border-strong)'};background:{active ? 'var(--et-accent-soft)' : 'var(--et-surface)'};color:{active ? 'var(--et-accent-strong)' : 'var(--et-text-2)'}"
          aria-pressed={active}
          on:click={() => toggleProject(project.id)}
        >
          <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{project.color}" aria-hidden="true"></span>
          {project.name}
        </button>
      {/each}
    </div>
  {/if}
  <span class="text-[12px]" style="color:var(--et-text-3)">Der Pool in „Heute · Planen“ zeigt zuerst Aufgaben aus diesen Projekten.</span>
</section>

<section aria-label="Wochenergebnis" class="et-card flex flex-col gap-2.5 px-4 pt-3.5 pb-4">
  <label for="week-outcome" class="et-h2">Was soll am Freitag stehen?</label>
  {#key weekStart}
    <textarea
      id="week-outcome"
      class="et-field resize-y"
      rows="3"
      value={plan.outcomeNote ?? ''}
      on:input={handleNoteInput}
      on:blur={flushNote}
      placeholder="z. B. Angebot für Kunde X fertig, Login-Flow implementiert, …"
    ></textarea>
  {/key}
</section>
