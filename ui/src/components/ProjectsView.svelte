<script lang="ts">
  import {
    $clients as clientsStore, $projects as projectsStore,
    $selectedProjectId as selectedProjectIdStore, $selectedProject as selectedProjectStore,
    addClient, addProject, updateProject, updateClient, removeProject,
  } from '../stores/projectStore';
  import { $tasks as tasksStore } from '../stores/taskStore';
  import { $templates as templatesStore, applyProjectTemplate } from '../stores/templateStore';
  import { $timeEntries as timeEntriesStore } from '../stores/timerStore';
  import { PROJECT_COLORS } from '../domain/types';
  import { isTauriAvailable } from '../lib/platform';
  import { buildProjectReportInput, generateProjectReport } from '../lib/reportService';
  import KanbanBoard from './KanbanBoard.svelte';
  import TemplatePickerModal from './TemplatePickerModal.svelte';
  import RecurringTasksPanel from './RecurringTasksPanel.svelte';

  $: clients = $clientsStore;
  $: projects = $projectsStore;
  $: selectedId = $selectedProjectIdStore;
  $: selectedProject = $selectedProjectStore;
  $: allTasks = $tasksStore;
  $: allTimeEntries = $timeEntriesStore;

  let reportGenerating = false;
  let reportMessage = '';

  async function handleGenerateReport() {
    if (!selectedProject) return;
    reportGenerating = true;
    reportMessage = '';
    try {
      const input = buildProjectReportInput(selectedProject, allTasks, allTimeEntries);
      const path = await generateProjectReport(input);
      reportMessage = `PDF gespeichert: ${path}`;
    } catch (e) {
      reportMessage = `Fehler: ${e}`;
    } finally {
      reportGenerating = false;
      setTimeout(() => { reportMessage = ''; }, 5000);
    }
  }

  // Tabs
  type Tab = 'projects' | 'recurring';
  let activeTab: Tab = 'projects';

  // Add client
  let addingClient = false;
  let newClientName = '';

  // Add project
  let addingProjectForClient: string | null = null;
  let newProjectName = '';

  // Edit project/client name
  let editingProjectName = false;
  let editProjectNameVal = '';
  let editingClientId: string | null = null;
  let editClientNameVal = '';

  // Template picker
  let showTemplatePicker = false;

  // Notes debounce
  let notesDebounce: ReturnType<typeof setTimeout> | null = null;
  function handleNotesChange(value: string) {
    if (!selectedId) return;
    if (notesDebounce) clearTimeout(notesDebounce);
    notesDebounce = setTimeout(() => updateProject(selectedId!, { notes: value }), 600);
  }

  function handleAddClient(e: Event) {
    e.preventDefault();
    if (!newClientName.trim()) return;
    addClient(newClientName.trim());
    newClientName = ''; addingClient = false;
  }

  function handleAddProject(e: Event, clientId: string) {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const project = addProject(clientId, newProjectName.trim());
    selectedProjectIdStore.set(project.id);
    newProjectName = ''; addingProjectForClient = null;
  }

  function startEditProjectName() {
    if (!selectedProject) return;
    editProjectNameVal = selectedProject.name;
    editingProjectName = true;
  }

  function saveProjectName() {
    if (selectedId && editProjectNameVal.trim()) {
      updateProject(selectedId, { name: editProjectNameVal.trim() });
    }
    editingProjectName = false;
  }

  const projectTaskCount = (pid: string) => allTasks.filter(t => t.projectId === pid).length;
  const projectDoneCount = (pid: string) => allTasks.filter(t => t.projectId === pid && t.status === 'done').length;

  function handleStatusSelect(e: Event) {
    if (!selectedId) return;
    const val = (e.currentTarget as HTMLSelectElement).value as 'active' | 'paused' | 'done';
    updateProject(selectedId, { status: val });
  }

  function handleNotesInput(e: Event) {
    handleNotesChange((e.currentTarget as HTMLTextAreaElement).value);
  }
</script>

<div class="projects-view">
  <!-- Left panel -->
  <div class="projects-sidebar">
    <div class="projects-sidebar-header">
      <div class="projects-tabs">
        <button class="projects-tab {activeTab === 'projects' ? 'projects-tab--active' : ''}"
          on:click={() => activeTab = 'projects'}>Projekte</button>
        <button class="projects-tab {activeTab === 'recurring' ? 'projects-tab--active' : ''}"
          on:click={() => activeTab = 'recurring'}>↺ Wiederholt</button>
      </div>
      {#if activeTab === 'projects'}
        <button class="icon-btn" on:click={() => addingClient = true} title="Neuer Kunde">+</button>
      {/if}
    </div>

    {#if activeTab === 'recurring'}
      <div style="padding:0 var(--space-3);overflow-y:auto;flex:1">
        <RecurringTasksPanel />
      </div>
    {:else}
      <div class="projects-list">
        {#if clients.length === 0 && !addingClient}
          <p class="projects-empty">Noch keine Kunden. Füge deinen ersten Kunden hinzu.</p>
        {/if}

        {#each clients as client (client.id)}
          {@const clientProjects = projects.filter(p => p.clientId === client.id)}
          <div class="client-group">
            <div class="client-header">
              <span class="client-dot" style="background:{client.color}" />
              {#if editingClientId === client.id}
                <!-- svelte-ignore a11y-autofocus -->
                <input class="inline-add-input" bind:value={editClientNameVal}
                  autofocus
                  on:blur={() => { if (editClientNameVal.trim()) updateClient(client.id, { name: editClientNameVal.trim() }); editingClientId = null; }}
                  on:keydown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') editingClientId = null; }}
                />
              {:else}
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <span class="client-name" on:dblclick={() => { editingClientId = client.id; editClientNameVal = client.name; }}>
                  {client.name}
                </span>
              {/if}
              <button class="icon-btn icon-btn--sm"
                on:click={() => { addingProjectForClient = client.id; newProjectName = ''; }}
                title="Neues Projekt">+</button>
            </div>

            {#each clientProjects as project (project.id)}
              {@const total = projectTaskCount(project.id)}
              {@const done = projectDoneCount(project.id)}
              <button
                class="project-item {selectedId === project.id ? 'project-item--active' : ''}"
                on:click={() => selectedProjectIdStore.set(project.id)}
              >
                <span class="project-color-dot" style="background:{project.color}" />
                <span class="project-item-name">{project.name}</span>
                {#if total > 0}<span class="project-item-badge">{done}/{total}</span>{/if}
                <span class="project-status-dot project-status-dot--{project.status}" />
              </button>
            {/each}

            {#if addingProjectForClient === client.id}
              <form class="inline-add-form" on:submit={(e) => handleAddProject(e, client.id)}>
                <!-- svelte-ignore a11y-autofocus -->
                <input class="inline-add-input" bind:value={newProjectName} placeholder="Projektname..."
                  autofocus on:keydown={(e) => { if (e.key === 'Escape') addingProjectForClient = null; }} />
              </form>
            {/if}
          </div>
        {/each}

        {#if addingClient}
          <form class="inline-add-form" on:submit={handleAddClient}>
            <!-- svelte-ignore a11y-autofocus -->
            <input class="inline-add-input" bind:value={newClientName} placeholder="Kundenname..."
              autofocus on:keydown={(e) => { if (e.key === 'Escape') addingClient = false; }} />
          </form>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Right panel -->
  <div class="project-detail">
    {#if !selectedProject}
      <div class="project-detail-empty">
        <p>Wähle ein Projekt aus oder lege ein neues an.</p>
      </div>
    {:else}
      <div class="project-detail-header">
        <div class="project-detail-title-row">
          <span class="project-detail-dot" style="background:{selectedProject.color}" />
          {#if editingProjectName}
            <!-- svelte-ignore a11y-autofocus -->
            <input
              class="add-task-input"
              bind:value={editProjectNameVal}
              autofocus
              on:blur={saveProjectName}
              on:keydown={(e) => { if (e.key === 'Enter') saveProjectName(); if (e.key === 'Escape') editingProjectName = false; }}
            />
          {:else}
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <h2 class="project-detail-name" on:dblclick={startEditProjectName} title="Doppelklick zum Bearbeiten">
              {selectedProject.name}
            </h2>
          {/if}
          <select class="project-status-select" value={selectedProject.status}
            on:change={handleStatusSelect}>
            <option value="active">Aktiv</option>
            <option value="paused">Pausiert</option>
            <option value="done">Abgeschlossen</option>
          </select>
          <button class="btn-ghost" on:click={() => showTemplatePicker = true}>Template anwenden</button>
          {#if isTauriAvailable()}
            <button class="btn-ghost" on:click={handleGenerateReport} disabled={reportGenerating}>
              {reportGenerating ? '...' : '↓ PDF-Bericht'}
            </button>
          {/if}
          <button class="btn-ghost" on:click={startEditProjectName} title="Name bearbeiten">✎</button>
        </div>

        <div class="project-color-picker">
          {#each PROJECT_COLORS as c (c)}
            <button
              class="color-swatch {selectedProject.color === c ? 'color-swatch--active' : ''}"
              style="background:{c}"
              on:click={() => updateProject(selectedProject.id, { color: c })}
              aria-label="Farbe {c}"
            />
          {/each}
        </div>
      </div>

      {#if reportMessage}
        <div class="report-message">{reportMessage}</div>
      {/if}

      <div class="project-notes-section">
        <label class="project-notes-label">Notizen & Fähigkeiten</label>
        {#key selectedProject.id}
          <textarea
            class="project-notes"
            value={selectedProject.notes ?? ''}
            on:input={handleNotesInput}
            placeholder="Tech-Stack, Client-Zugänge, besondere Anforderungen, Code-Snippets..."
            rows={4}
          />
        {/key}
      </div>

      <div class="project-kanban-section">
        <KanbanBoard projectId={selectedProject.id} projectColor={selectedProject.color} />
      </div>

      <div class="project-danger">
        <button class="btn-danger" on:click={() => {
          if (confirm(`Projekt „${selectedProject?.name}" wirklich löschen?`)) removeProject(selectedProject.id);
        }}>Projekt löschen</button>
      </div>

      {#if showTemplatePicker}
        <TemplatePickerModal
          projectId={selectedProject.id}
          onClose={() => showTemplatePicker = false}
        />
      {/if}
    {/if}
  </div>
</div>
