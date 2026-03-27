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

<div class="flex-1 grid overflow-hidden" style="grid-template-columns: 240px 1fr">
  <!-- Left panel -->
  <div class="border-r border-border flex flex-col overflow-hidden">
    <div class="flex items-center justify-between p-4 flex-shrink-0">
      <div class="flex gap-[2px] flex-1 min-w-0">
        <button
          class="flex-1 px-2 py-1 text-[12px] font-medium rounded-lg transition-colors whitespace-nowrap overflow-hidden text-ellipsis {activeTab === 'projects' ? 'bg-accent-subtle text-accent' : 'text-secondary hover:bg-bg hover:text-primary'}"
          on:click={() => activeTab = 'projects'}
        >Projekte</button>
        <button
          class="flex-1 px-2 py-1 text-[12px] font-medium rounded-lg transition-colors whitespace-nowrap overflow-hidden text-ellipsis {activeTab === 'recurring' ? 'bg-accent-subtle text-accent' : 'text-secondary hover:bg-bg hover:text-primary'}"
          on:click={() => activeTab = 'recurring'}
        >↺ Wiederholt</button>
      </div>
      {#if activeTab === 'projects'}
        <button
          class="w-6 h-6 flex items-center justify-center rounded-lg text-muted text-lg hover:bg-bg hover:text-primary transition-colors flex-shrink-0 ml-1"
          on:click={() => addingClient = true}
          title="Neuer Kunde"
        >+</button>
      {/if}
    </div>

    {#if activeTab === 'recurring'}
      <div class="px-3 overflow-y-auto flex-1">
        <RecurringTasksPanel />
      </div>
    {:else}
      <div class="flex-1 overflow-y-auto px-3 pb-4 flex flex-col gap-1">
        {#if clients.length === 0 && !addingClient}
          <p class="text-[13px] text-muted leading-relaxed px-2 py-4">Noch keine Kunden. Füge deinen ersten Kunden hinzu.</p>
        {/if}

        {#each clients as client (client.id)}
          {@const clientProjects = projects.filter(p => p.clientId === client.id)}
          <div class="flex flex-col gap-[1px] mb-3">
            <div class="flex items-center gap-2 px-2 py-1 mb-[2px]">
              <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{client.color}" />
              {#if editingClientId === client.id}
                <!-- svelte-ignore a11y-autofocus -->
                <input
                  class="flex-1 px-2 py-1 border border-accent rounded-lg text-[13px] outline-none bg-surface min-w-0"
                  bind:value={editClientNameVal}
                  autofocus
                  on:blur={() => { if (editClientNameVal.trim()) updateClient(client.id, { name: editClientNameVal.trim() }); editingClientId = null; }}
                  on:keydown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') editingClientId = null; }}
                />
              {:else}
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <span
                  class="text-[12px] font-semibold text-secondary flex-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0 cursor-default"
                  on:dblclick={() => { editingClientId = client.id; editClientNameVal = client.name; }}
                >
                  {client.name}
                </span>
              {/if}
              <button
                class="w-[18px] h-[18px] flex items-center justify-center rounded-lg text-muted text-sm hover:bg-bg hover:text-primary transition-colors flex-shrink-0"
                on:click={() => { addingProjectForClient = client.id; newProjectName = ''; }}
                title="Neues Projekt"
              >+</button>
            </div>

            {#each clientProjects as project (project.id)}
              {@const total = projectTaskCount(project.id)}
              {@const done = projectDoneCount(project.id)}
              <button
                class="flex items-center gap-2 py-[6px] px-2 pl-6 rounded-lg w-full text-left transition-colors min-w-0 {selectedId === project.id ? 'bg-accent-subtle' : 'hover:bg-bg'}"
                on:click={() => selectedProjectIdStore.set(project.id)}
              >
                <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{project.color}" />
                <span class="flex-1 text-[13px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 {selectedId === project.id ? 'text-accent font-medium' : 'text-primary'}">{project.name}</span>
                {#if total > 0}<span class="text-[11px] text-muted whitespace-nowrap flex-shrink-0">{done}/{total}</span>{/if}
                <span class="w-[6px] h-[6px] rounded-full flex-shrink-0 {project.status === 'active' ? 'bg-success' : project.status === 'paused' ? 'bg-yellow-400' : 'bg-gray-300'}" />
              </button>
            {/each}

            {#if addingProjectForClient === client.id}
              <form class="py-1 pl-6 pr-2" on:submit={(e) => handleAddProject(e, client.id)}>
                <!-- svelte-ignore a11y-autofocus -->
                <input
                  class="w-full px-2 py-[5px] border border-accent rounded-lg text-[13px] outline-none bg-surface"
                  bind:value={newProjectName}
                  placeholder="Projektname..."
                  autofocus
                  on:keydown={(e) => { if (e.key === 'Escape') addingProjectForClient = null; }}
                />
              </form>
            {/if}
          </div>
        {/each}

        {#if addingClient}
          <form class="py-1" on:submit={handleAddClient}>
            <!-- svelte-ignore a11y-autofocus -->
            <input
              class="w-full px-2 py-[5px] border border-accent rounded-lg text-[13px] outline-none bg-surface"
              bind:value={newClientName}
              placeholder="Kundenname..."
              autofocus
              on:keydown={(e) => { if (e.key === 'Escape') addingClient = false; }}
            />
          </form>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Right panel -->
  <div class="flex flex-col overflow-hidden">
    {#if !selectedProject}
      <div class="flex-1 flex items-center justify-center text-muted text-sm">
        <p>Wähle ein Projekt aus oder lege ein neues an.</p>
      </div>
    {:else}
      <div class="px-6 py-4 border-b border-border flex flex-col gap-3 flex-shrink-0">
        <div class="flex items-center gap-3 min-w-0">
          <span class="w-3 h-3 rounded-full flex-shrink-0" style="background:{selectedProject.color}" />
          {#if editingProjectName}
            <!-- svelte-ignore a11y-autofocus -->
            <input
              class="flex-1 px-3 py-2 border border-accent rounded-lg text-sm outline-none bg-surface min-w-0"
              bind:value={editProjectNameVal}
              autofocus
              on:blur={saveProjectName}
              on:keydown={(e) => { if (e.key === 'Enter') saveProjectName(); if (e.key === 'Escape') editingProjectName = false; }}
            />
          {:else}
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <h2
              class="text-base font-semibold text-primary flex-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0 cursor-default"
              on:dblclick={startEditProjectName}
              title="Doppelklick zum Bearbeiten"
            >
              {selectedProject.name}
            </h2>
          {/if}
          <select
            class="border border-border rounded-md px-2 py-[2px] text-[12px] bg-bg outline-none text-secondary flex-shrink-0"
            value={selectedProject.status}
            on:change={handleStatusSelect}
          >
            <option value="active">Aktiv</option>
            <option value="paused">Pausiert</option>
            <option value="done">Abgeschlossen</option>
          </select>
          <button
            class="px-3 py-1 text-secondary rounded-lg text-[13px] hover:bg-gray-100 transition-colors whitespace-nowrap"
            on:click={() => showTemplatePicker = true}
          >Template anwenden</button>
          {#if isTauriAvailable()}
            <button
              class="px-3 py-1 text-secondary rounded-lg text-[13px] hover:bg-gray-100 transition-colors whitespace-nowrap"
              on:click={handleGenerateReport}
              disabled={reportGenerating}
            >{reportGenerating ? '...' : '↓ PDF-Bericht'}</button>
          {/if}
          <button
            class="px-3 py-1 text-secondary rounded-lg text-[13px] hover:bg-gray-100 transition-colors"
            on:click={startEditProjectName}
            title="Name bearbeiten"
          >✎</button>
        </div>

        <div class="flex gap-1 flex-wrap">
          {#each PROJECT_COLORS as c (c)}
            <button
              class="w-[18px] h-[18px] rounded-full transition-transform hover:scale-[1.15] {selectedProject.color === c ? 'ring-2 ring-secondary ring-offset-2' : ''}"
              style="background:{c}"
              on:click={() => updateProject(selectedProject.id, { color: c })}
              aria-label="Farbe {c}"
            />
          {/each}
        </div>
      </div>

      {#if reportMessage}
        <div class="px-6 py-2 text-[13px] text-secondary bg-accent-subtle border-b border-border flex-shrink-0">{reportMessage}</div>
      {/if}

      <div class="px-6 py-4 border-b border-border-subtle flex-shrink-0 flex flex-col gap-2">
        <label class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">Notizen & Fähigkeiten</label>
        {#key selectedProject.id}
          <textarea
            class="w-full px-3 py-3 border border-border rounded-lg text-[13px] font-mono leading-relaxed resize-y outline-none bg-bg text-primary min-h-[80px] focus:border-accent focus:bg-surface"
            value={selectedProject.notes ?? ''}
            on:input={handleNotesInput}
            placeholder="Tech-Stack, Client-Zugänge, besondere Anforderungen, Code-Snippets..."
            rows={4}
          />
        {/key}
      </div>

      <div class="flex-1 overflow-hidden flex flex-col">
        <KanbanBoard projectId={selectedProject.id} projectColor={selectedProject.color} />
      </div>

      <div class="px-6 py-4 border-t border-border-subtle flex-shrink-0">
        <button
          class="px-3 py-1 text-red-500 border border-red-200 rounded-lg text-[12px] hover:bg-red-50 transition-colors"
          on:click={() => {
            if (confirm(`Projekt „${selectedProject?.name}" wirklich löschen?`)) removeProject(selectedProject.id);
          }}
        >Projekt löschen</button>
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
