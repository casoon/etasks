<!-- @module:projects -->
<script lang="ts">
  import { $clients as clientsStore, $selectedProjectId as selectedProjectIdStore, updateProject } from '../../stores/projectStore';
  import { $tasks as tasksStore } from '../../stores/taskStore';
  import { $timeEntries as timeEntriesStore } from '../../stores/timerStore';
  import { $billingItems as billingItemsStore, $billingItemTasks as billingItemTasksStore } from '../../stores/billingStore';
  import { $appConfig as appConfigStore } from '../../stores/configStore';
  import { saveAsTemplate } from '../../stores/templateStore';
  import { toast } from '../../stores/toastStore';
  import { deleteProjectCascade } from '../../lib/taskActions';
  import { isTauriAvailable } from '../../lib/platform';
  import { buildProjectReportInput, generateProjectReport } from '../../lib/reportService';
  import { exportProjectOffer } from '../../lib/projectOffer';
  import { deadlineLabel, deadlineState, projectStats } from '../../lib/projectStats';
  import { formatHm, today } from '../../domain/dateUtils';
  import type { Project, Task } from '../../domain/types';
  import KanbanBoard from './KanbanBoard.svelte';
  import ColorSwatches from './ColorSwatches.svelte';
  import ProjectBillingTab from './ProjectBillingTab.svelte';
  import ProjectTimesTab from './ProjectTimesTab.svelte';
  import ProjectNotes from './ProjectNotes.svelte';
  import ProjectDetailsTab from './ProjectDetailsTab.svelte';
  import TemplatePickerModal from '../modals/TemplatePickerModal.svelte';

  export let project: Project;

  type TabId = 'board' | 'positions' | 'times' | 'notes' | 'details';

  $: client = $clientsStore.find((c) => c.id === project.clientId) ?? null;
  $: stats = projectStats(project.id, $tasksStore, $timeEntriesStore, Date.now());
  $: positionCount = $billingItemsStore.filter((i) => i.projectId === project.id).length;
  $: dlState = deadlineState(project, today());
  $: tabs = [
    { id: 'board' as TabId, label: 'Board' },
    { id: 'positions' as TabId, label: positionCount > 0 ? `Positionen · ${positionCount}` : 'Positionen' },
    { id: 'times' as TabId, label: 'Zeiten' },
    { id: 'notes' as TabId, label: 'Notizen' },
    { id: 'details' as TabId, label: 'Details' },
  ];

  let tab: TabId = 'board';

  function onTabKey(e: KeyboardEvent) {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const i = tabs.findIndex((t) => t.id === tab);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tab = tabs[next].id;
    document.getElementById(`ptab-${tab}`)?.focus();
  }

  // ── Status ──
  const STATUS_DOT = { active: 'var(--et-success)', paused: 'var(--et-warning)', done: 'var(--et-border-control)' } as const;

  // ── Rename ──
  let renaming = false;
  let nameValue = '';
  let renameCancelled = false;

  function startRename() {
    menuOpen = false;
    nameValue = project.name;
    renameCancelled = false;
    renaming = true;
  }

  function saveName() {
    if (!renameCancelled && nameValue.trim()) updateProject(project.id, { name: nameValue.trim() });
    renaming = false;
  }

  // ── More menu ──
  let menuOpen = false;
  let menuRoot: HTMLElement;
  let menuButton: HTMLButtonElement;

  function onWindowClick(e: MouseEvent) {
    if (menuOpen && menuRoot && !menuRoot.contains(e.target as Node)) menuOpen = false;
  }

  function onWindowKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && menuOpen) {
      menuOpen = false;
      menuButton?.focus();
    }
  }

  const menuItem = 'flex items-center w-full h-11 px-3 rounded-lg text-left font-medium transition-colors hover:bg-[var(--et-surface-sunken)]';

  // ── Template ──
  let savingTemplate = false;
  let templateName = '';
  let showTemplatePicker = false;

  function openSaveTemplate() {
    menuOpen = false;
    templateName = project.name;
    savingTemplate = true;
  }

  function saveTemplate() {
    const name = templateName.trim();
    const projectTasks = $tasksStore.filter((t) => t.projectId === project.id && !t.recurrence);
    if (!name) return;
    if (projectTasks.length === 0) {
      toast('Das Projekt hat noch keine Aufgaben.', 'error');
      return;
    }
    saveAsTemplate(
      name,
      projectTasks.map((t) => ({
        title: t.title,
        estimatedMinutes: t.estimatedMinutes ?? 30,
        kanbanStatus: 'backlog' as const,
        tags: t.tags,
      })),
    );
    savingTemplate = false;
    toast(`Vorlage „${name}“ gespeichert`, 'success');
  }

  // ── Delete ──
  function removeProject() {
    menuOpen = false;
    const count = $tasksStore.filter((t) => t.projectId === project.id && !t.recurrence).length;
    if (
      confirm(
        `Projekt „${project.name}“ wirklich löschen?\n\nGelöscht werden auch ${count} Aufgabe(n), Rechnungspositionen, Zeiteinträge und Termine des Projekts. Rechnungen bleiben erhalten.`,
      )
    )
      deleteProjectCascade(project.id);
  }

  // ── PDF ──
  const pdfAvailable = isTauriAvailable();
  let message = '';
  let reportBusy = false;
  let offerBusy = false;

  function showMessage(text: string) {
    message = text;
    setTimeout(() => { if (message === text) message = ''; }, 5000);
  }

  async function createReport() {
    reportBusy = true;
    message = '';
    try {
      const input = buildProjectReportInput(project, $tasksStore as Task[], [...$timeEntriesStore]);
      showMessage(`PDF gespeichert: ${await generateProjectReport(input)}`);
    } catch (e) {
      showMessage(`Fehler: ${e}`);
    } finally {
      reportBusy = false;
    }
  }

  async function createOffer() {
    if (offerBusy) return;
    offerBusy = true;
    message = '';
    try {
      const result = await exportProjectOffer({
        project,
        client,
        items: $billingItemsStore
          .filter((i) => i.projectId === project.id)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
        links: $billingItemTasksStore,
        tasks: $tasksStore,
        config: $appConfigStore,
      });
      if (result) showMessage(result);
    } finally {
      offerBusy = false;
    }
  }
</script>

<svelte:window on:click={onWindowClick} on:keydown={onWindowKey} />

<div class="flex-1 overflow-y-auto">
  <div class="flex flex-col gap-4 px-8 pt-4 pb-7">
    <nav aria-label="Pfad" class="flex items-center gap-2 text-[13px]">
      <button class="flex items-center gap-1.5 min-h-11 font-semibold" style="color:var(--et-accent)" on:click={() => selectedProjectIdStore.set(null)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"></path></svg>
        Projekte
      </button>
      <span style="color:var(--et-border-control)" aria-hidden="true">/</span>
      <span style="color:var(--et-text-3)">{client?.name ?? 'Intern'}</span>
      <span style="color:var(--et-border-control)" aria-hidden="true">/</span>
      <span class="font-semibold" aria-current="page">{project.name}</span>
    </nav>

    <header class="flex flex-wrap items-center gap-3">
      <span class="w-4 h-4 rounded-[5px] flex-shrink-0" style="background:{project.color}" aria-hidden="true"></span>
      {#if renaming}
        <label class="sr-only" for="project-name">Projektname</label>
        <!-- svelte-ignore a11y-autofocus -->
        <input
          id="project-name"
          class="et-field flex-[1_1_260px] text-[20px] font-bold"
          bind:value={nameValue}
          autofocus
          on:blur={saveName}
          on:keydown={(e) => {
            if (e.key === 'Enter') saveName();
            if (e.key === 'Escape') { renameCancelled = true; renaming = false; }
          }}
        />
      {:else}
        <h1 class="flex-[1_1_260px] min-w-0 text-[24px] font-bold tracking-[-0.01em] leading-tight break-words">{project.name}</h1>
      {/if}

      <label class="relative flex items-center">
        <span class="sr-only">Status</span>
        <span class="absolute left-3 w-2 h-2 rounded-full pointer-events-none" style="background:{STATUS_DOT[project.status]}" aria-hidden="true"></span>
        <select
          class="et-field appearance-none w-auto pl-8 pr-9 font-medium cursor-pointer"
          value={project.status}
          on:change={(e) => updateProject(project.id, { status: e.currentTarget.value === 'paused' ? 'paused' : e.currentTarget.value === 'done' ? 'done' : 'active' })}
        >
          <option value="active">Aktiv</option>
          <option value="paused">Pausiert</option>
          <option value="done">Abgeschlossen</option>
        </select>
        <svg class="absolute right-3 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>
      </label>

      <button class="et-btn" disabled={!pdfAvailable || offerBusy} on:click={createOffer}>{offerBusy ? 'Angebot …' : 'Angebot als PDF'}</button>
      <button class="et-btn" disabled={!pdfAvailable || reportBusy} on:click={createReport}>{reportBusy ? 'Bericht …' : 'Statusbericht als PDF'}</button>

      <div class="relative" bind:this={menuRoot}>
        <button
          class="et-btn et-btn-icon"
          aria-label="Weitere Aktionen"
          aria-haspopup="true"
          aria-expanded={menuOpen}
          bind:this={menuButton}
          on:click={() => (menuOpen = !menuOpen)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="19" cy="12" r="1.8"></circle></svg>
        </button>
        {#if menuOpen}
          <div class="et-card absolute right-0 top-[52px] z-20 w-[300px] p-2 flex flex-col" style="box-shadow:var(--et-shadow-overlay)">
            <button class={menuItem} on:click={startRename}>Name ändern</button>
            <div class="flex flex-col gap-2 px-3 py-2">
              <span class="et-label">Farbe</span>
              <ColorSwatches color={project.color} onPick={(c) => updateProject(project.id, { color: c })} />
            </div>
            <button class={menuItem} on:click={openSaveTemplate}>Als Vorlage speichern</button>
            <button class={menuItem} on:click={() => { menuOpen = false; showTemplatePicker = true; }}>Vorlage anwenden</button>
            <div class="my-1 border-t" style="border-color:var(--et-border-subtle)"></div>
            <button class="{menuItem}" style="color:var(--et-danger)" on:click={removeProject}>Projekt löschen</button>
          </div>
        {/if}
      </div>
    </header>

    {#if !pdfAvailable}
      <p class="text-[12px] -mt-2" style="color:var(--et-text-3)">PDF-Angebot und Statusbericht gibt es nur in der Desktop-App.</p>
    {/if}

    {#if message}
      <div class="px-4 py-2.5 rounded-xl text-[13px]" style="background:var(--et-accent-soft);color:var(--et-accent-strong)" role="status">{message}</div>
    {/if}

    {#if savingTemplate}
      <form class="flex flex-wrap items-end gap-3 px-5 py-3 rounded-xl" style="background:var(--et-accent-soft)" aria-label="Als Vorlage speichern" on:submit|preventDefault={saveTemplate}>
        <div class="flex-[1_1_260px] flex flex-col gap-1">
          <label class="et-label" for="tpl-name">Name der Vorlage</label>
          <!-- svelte-ignore a11y-autofocus -->
          <input id="tpl-name" class="et-field" bind:value={templateName} autofocus />
        </div>
        <div class="flex gap-2">
          <button type="submit" class="et-btn et-btn-primary" disabled={!templateName.trim()}>Speichern</button>
          <button type="button" class="et-btn" on:click={() => (savingTemplate = false)}>Abbrechen</button>
        </div>
        <p class="basis-full text-[12px]" style="color:var(--et-accent-strong)">Speichert die Aufgaben des Projekts mit Titel, Schätzung und Tags.</p>
      </form>
    {/if}

    <div class="et-card flex flex-wrap items-center gap-x-7 gap-y-3 px-5 py-3.5" style="border-radius:12px">
      <span class="flex-[1_1_260px] flex items-center gap-3">
        <span class="flex-1 h-2 rounded-[4px] flex" style="background:var(--et-track)" aria-hidden="true"><span class="rounded-[4px]" style="width:{stats.total > 0 ? (stats.done / stats.total) * 100 : 0}%;background:{project.color}"></span></span>
        <span class="font-semibold tabular-nums">{stats.done} / {stats.total} erledigt</span>
      </span>
      <span class="flex flex-col"><span class="text-[12px]" style="color:var(--et-text-3)">Erfasst</span><span class="font-semibold">{formatHm(stats.trackedMinutes)}</span></span>
      <span class="flex flex-col">
        <span class="text-[12px]" style="color:var(--et-text-3)">Deadline</span>
        <span class="font-semibold" style="color:{dlState === 'overdue' ? 'var(--et-danger)' : dlState === 'soon' ? 'var(--et-warning-text)' : 'inherit'}">{deadlineLabel(project, today())}</span>
      </span>
    </div>

    <!-- svelte-ignore a11y-interactive-supports-focus -->
    <div role="tablist" aria-label="Projektbereiche" class="flex flex-wrap gap-1 border-b" style="border-color:var(--et-border)" on:keydown={onTabKey}>
      {#each tabs as t (t.id)}
        {@const selected = tab === t.id}
        <button
          id="ptab-{t.id}"
          role="tab"
          aria-selected={selected}
          aria-controls="ppanel"
          tabindex={selected ? 0 : -1}
          class="h-11 px-3.5 -mb-px border-b-2 {selected ? 'font-semibold' : 'font-medium hover:bg-[var(--et-surface-sunken)]'}"
          style="border-color:{selected ? 'var(--et-accent)' : 'transparent'};color:{selected ? 'var(--et-accent-strong)' : 'var(--et-text-2)'}"
          on:click={() => (tab = t.id)}
        >{t.label}</button>
      {/each}
    </div>

    <div id="ppanel" role="tabpanel" aria-labelledby="ptab-{tab}">
      {#if tab === 'board'}
        <KanbanBoard projectId={project.id} projectColor={project.color} />
      {:else if tab === 'positions'}
        <ProjectBillingTab {project} />
      {:else if tab === 'times'}
        <ProjectTimesTab {project} />
      {:else if tab === 'notes'}
        <ProjectNotes {project} />
      {:else}
        <ProjectDetailsTab {project} {client} />
      {/if}
    </div>
  </div>
</div>

{#if showTemplatePicker}
  <TemplatePickerModal projectId={project.id} onClose={() => (showTemplatePicker = false)} />
{/if}
