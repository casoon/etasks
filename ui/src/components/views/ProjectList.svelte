<!-- @module:projects -->
<script lang="ts">
  import {
    $clients as clientsStore,
    $projects as projectsStore,
    $selectedProjectId as selectedProjectIdStore,
    addProject,
  } from '../../stores/projectStore';
  import { $tasks as tasksStore } from '../../stores/taskStore';
  import { $timeEntries as timeEntriesStore } from '../../stores/timerStore';
  import { $navItem as navItemStore } from '../../stores/uiStore';
  import { formatHm, today } from '../../domain/dateUtils';
  import { deadlineLabel, deadlineState, filterProjects, projectStats, type StatusFilter } from '../../lib/projectStats';
  import TemplatePickerModal from '../modals/TemplatePickerModal.svelte';

  $: clients = $clientsStore;
  $: projects = $projectsStore;
  $: todayKey = today();
  $: clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? '';

  const STATUS_LABELS = { active: 'Aktiv', paused: 'Pausiert', done: 'Abgeschlossen' } as const;
  const FILTERS: { id: StatusFilter; label: string }[] = [
    { id: 'active', label: 'Aktiv' },
    { id: 'paused', label: 'Pausiert' },
    { id: 'done', label: 'Abgeschlossen' },
    { id: 'all', label: 'Alle' },
  ];

  let status: StatusFilter = 'active';
  let query = '';
  let showTemplates = false;

  $: counts = {
    active: projects.filter((p) => p.status === 'active').length,
    paused: projects.filter((p) => p.status === 'paused').length,
    done: projects.filter((p) => p.status === 'done').length,
    all: projects.length,
  };
  $: rows = filterProjects(projects, clients, status, query).map((project) => ({
    project,
    stats: projectStats(project.id, $tasksStore, $timeEntriesStore, Date.now()),
  }));
  $: activeTracked = projects
    .filter((p) => p.status === 'active')
    .reduce((sum, p) => sum + projectStats(p.id, $tasksStore, $timeEntriesStore, Date.now()).trackedMinutes, 0);

  // ── New project ──
  let creating = false;
  let newName = '';
  let newClientId = '';

  function openCreate() {
    creating = true;
    newName = '';
    newClientId = '';
  }

  function create() {
    if (!newName.trim()) return;
    const project = addProject(newClientId, newName.trim());
    creating = false;
    selectedProjectIdStore.set(project.id);
  }
</script>

<div class="flex-1 overflow-y-auto">
  <div class="flex flex-col gap-5 px-8 pt-5 pb-7">
    <header class="flex flex-wrap items-center gap-3">
      <div class="flex-[1_1_280px] flex flex-col gap-0.5">
        <h1 class="text-[24px] font-bold tracking-[-0.01em] leading-tight">Projekte</h1>
        <span class="text-[13px]" style="color:var(--et-text-3)">{counts.active} aktiv · {formatHm(activeTracked)} erfasst in aktiven Projekten</span>
      </div>
      <button class="et-btn" on:click={() => (showTemplates = true)}>Vorlagen</button>
      <button class="et-btn et-btn-primary" on:click={openCreate}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>
        Neues Projekt
      </button>
    </header>

    {#if creating}
      <form class="flex flex-wrap items-end gap-3 px-5 py-4 rounded-xl" style="background:var(--et-accent-soft)" aria-label="Neues Projekt" on:submit|preventDefault={create}>
        <div class="flex-[2_1_220px] flex flex-col gap-1">
          <label class="et-label" for="np-name">Projektname</label>
          <!-- svelte-ignore a11y-autofocus -->
          <input id="np-name" class="et-field" bind:value={newName} autofocus />
        </div>
        <div class="flex-[1_1_200px] flex flex-col gap-1">
          <label class="et-label" for="np-client">Kunde</label>
          <select id="np-client" class="et-field" bind:value={newClientId}>
            <option value="">Intern (kein Kunde)</option>
            {#each clients as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
          </select>
        </div>
        <div class="flex gap-2">
          <button type="submit" class="et-btn et-btn-primary" disabled={!newName.trim()}>Anlegen</button>
          <button type="button" class="et-btn" on:click={() => (creating = false)}>Abbrechen</button>
        </div>
        <p class="basis-full text-[12px]" style="color:var(--et-accent-strong)">Ohne Kunde ist das Projekt intern. Die Kundenzuordnung lässt sich später genau einmal setzen.</p>
      </form>
    {/if}

    <div class="flex flex-wrap items-center gap-3">
      <div class="et-seg" role="group" aria-label="Status filtern">
        {#each FILTERS as f (f.id)}
          <button aria-pressed={status === f.id} on:click={() => (status = f.id)}>{f.label}{f.id === 'all' ? '' : ` · ${counts[f.id]}`}</button>
        {/each}
      </div>
      <span class="flex-1"></span>
      <label class="flex items-center gap-2 h-11 w-[260px] max-w-full px-3 rounded-[10px] border bg-surface focus-within:outline-2 focus-within:outline-offset-2" style="border-color:var(--et-border-strong);outline-color:var(--et-accent)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--et-text-3)" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6"></circle><path d="M16 16l4 4"></path></svg>
        <input type="search" class="flex-1 min-w-0 bg-transparent border-none outline-none" aria-label="Projekt oder Kunde suchen" placeholder="Projekt oder Kunde suchen" bind:value={query} />
      </label>
    </div>

    <div class="overflow-x-auto et-card">
      <div class="min-w-[860px] flex flex-col">
        <div class="et-th grid items-center gap-4 px-5 py-2.5" style="grid-template-columns:2.2fr 1.3fr 1.5fr 0.8fr 1.1fr 28px">
          <span>Projekt</span><span>Kunde</span><span>Fortschritt</span><span>Erfasst</span><span>Deadline</span><span></span>
        </div>
        {#each rows as { project, stats } (project.id)}
          {@const state = deadlineState(project, todayKey)}
          <button
            class="et-row grid items-center gap-4 min-h-[68px] px-5 w-full text-left"
            style="grid-template-columns:2.2fr 1.3fr 1.5fr 0.8fr 1.1fr 28px"
            on:click={() => selectedProjectIdStore.set(project.id)}
          >
            <span class="flex items-center gap-3 min-w-0">
              <span class="w-3 h-3 rounded-[4px] flex-shrink-0" style="background:{project.color}" aria-hidden="true"></span>
              <span class="flex flex-col min-w-0">
                <span class="flex items-center gap-2 min-w-0">
                  <span class="text-[15px] font-semibold truncate">{project.name}</span>
                  {#if project.status !== 'active'}<span class="et-badge">{STATUS_LABELS[project.status]}</span>{/if}
                </span>
                <span class="text-[12px]" style="color:var(--et-text-3)">{stats.open} offen{stats.inProgress > 0 ? ` · ${stats.inProgress} in Arbeit` : ''}</span>
              </span>
            </span>
            <span class="truncate" style="color:{project.clientId ? 'inherit' : 'var(--et-text-3)'}">{project.clientId ? clientName(project.clientId) || '–' : 'Intern'}</span>
            {#if stats.total > 0}
              <span class="flex items-center gap-2.5">
                <span class="flex-1 h-1.5 rounded-[3px] flex" style="background:var(--et-track)" aria-hidden="true"><span class="rounded-[3px]" style="width:{(stats.done / stats.total) * 100}%;background:{project.color}"></span></span>
                <span class="text-[13px] tabular-nums" style="color:var(--et-text-3)">{stats.done} / {stats.total}</span>
              </span>
            {:else}
              <span class="text-[13px]" style="color:var(--et-text-3)">keine Aufgaben</span>
            {/if}
            <span class="tabular-nums">{formatHm(stats.trackedMinutes)}</span>
            <span>
              {#if state === 'overdue'}
                <span class="et-badge et-badge-red">{deadlineLabel(project, todayKey)}</span>
              {:else if state === 'soon'}
                <span class="et-badge et-badge-yellow">{deadlineLabel(project, todayKey)}</span>
              {:else}
                <span class="text-[13px]" style="color:{state === 'none' ? 'var(--et-text-3)' : 'var(--et-text-2)'}">{deadlineLabel(project, todayKey)}</span>
              {/if}
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--et-text-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>
          </button>
        {/each}

        {#if rows.length === 0}
          <div class="et-row flex flex-col items-start gap-3 px-5 py-8">
            <p class="text-[13px]" style="color:var(--et-text-3)">
              {projects.length === 0
                ? 'Noch keine Projekte.'
                : query.trim()
                  ? 'Kein Projekt passt zur Suche.'
                  : status === 'all'
                    ? 'Noch keine Projekte.'
                    : `Keine Projekte mit dem Status „${STATUS_LABELS[status]}“.`}
            </p>
            {#if projects.length === 0}
              <button class="et-btn et-btn-primary" on:click={openCreate}>Erstes Projekt anlegen</button>
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <div class="et-hint flex flex-wrap items-center gap-3">
      <span class="flex-[1_1_320px]">Projekte gehören zu einem Kunden oder sind intern. Die Kundenzuordnung lässt sich später genau einmal setzen.</span>
      <button class="font-semibold min-h-11 px-1" style="color:var(--et-accent)" on:click={() => navItemStore.set('clients')}>Kunden verwalten →</button>
    </div>
  </div>
</div>

{#if showTemplates}
  <TemplatePickerModal projectId={null} onClose={() => (showTemplates = false)} />
{/if}
