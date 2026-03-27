<script lang="ts">
  import {
    $clients as clientsStore, $projects as projectsStore,
    $selectedProjectId as selectedProjectIdStore, $selectedProject as selectedProjectStore,
    addClient, addProject, updateProject, updateClient, removeProject, removeClient,
  } from '../stores/projectStore';
  import { $tasks as tasksStore } from '../stores/taskStore';
  import { $templates as templatesStore, applyProjectTemplate } from '../stores/templateStore';
  import { $timeEntries as timeEntriesStore } from '../stores/timerStore';
  import { $services as servicesStore, addService, updateService, removeService } from '../stores/serviceStore';
  import { $projectsView as projectsViewStore } from '../stores/uiStore';
  import { PROJECT_COLORS } from '../domain/types';
  import type { ServiceItem, Client } from '../domain/types';
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
  $: services = $servicesStore;

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

  // Right panel view – driven by global store (TopBar switch)
  $: rightView = $projectsViewStore;

  // Add client
  let addingClientSource: 'left' | 'right' | null = null;
  $: addingClient = addingClientSource !== null;
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
    newClientName = ''; addingClientSource = null;
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

  // ── Kunden view ───────────────────────────────────────────────────────────────

  let selectedClientId: string | null = null;
  $: selectedClient = selectedClientId ? clients.find(c => c.id === selectedClientId) ?? null : null;
  $: clientProjects = selectedClientId ? projects.filter(p => p.clientId === selectedClientId) : [];

  function handleDeleteClient() {
    if (!selectedClient) return;
    if (confirm('Kunden "' + selectedClient.name + '" und alle Projekte loeschen?')) {
      removeClient(selectedClient.id);
      selectedClientId = null;
    }
  }

  // Returns an on:input handler for a string client field (no TS cast in template)
  let clientFieldDebounce: ReturnType<typeof setTimeout> | null = null;
  function onClientStr(field: keyof Client) {
    return (e: Event) => {
      if (!selectedClientId) return;
      const value = (e.currentTarget as HTMLInputElement | HTMLTextAreaElement).value;
      if (clientFieldDebounce) clearTimeout(clientFieldDebounce);
      clientFieldDebounce = setTimeout(() => updateClient(selectedClientId!, { [field]: value } as Partial<Client>), 400);
    };
  }
  function onClientNum(field: keyof Client) {
    return (e: Event) => {
      if (!selectedClientId) return;
      const raw = (e.currentTarget as HTMLInputElement).value;
      const value = parseFloat(raw) || undefined;
      if (clientFieldDebounce) clearTimeout(clientFieldDebounce);
      clientFieldDebounce = setTimeout(() => updateClient(selectedClientId!, { [field]: value } as Partial<Client>), 400);
    };
  }

  // ── Leistungen view ───────────────────────────────────────────────────────────

  let addingService = false;
  let editingServiceId: string | null = null;
  $: editingService = editingServiceId ? (services.find(x => x.id === editingServiceId) ?? null) : null;

  interface ServiceDraft {
    name: string;
    description: string;
    unit: string;
    unitPrice: number | null;
    vatRate: number | null;
    category: string;
  }

  const emptyDraft = (): ServiceDraft => ({
    name: '', description: '', unit: 'Stunde', unitPrice: null, vatRate: 19, category: '',
  });

  let serviceDraft: ServiceDraft = emptyDraft();
  let editDraft: ServiceDraft = emptyDraft();

  function startEditService(s: ServiceItem) {
    editingServiceId = s.id;
    editDraft = {
      name: s.name, description: s.description, unit: s.unit,
      unitPrice: s.unitPrice, vatRate: s.vatRate, category: s.category ?? '',
    };
  }

  function saveService() {
    if (!serviceDraft.name.trim()) return;
    addService({
      name: serviceDraft.name.trim(),
      description: serviceDraft.description.trim(),
      unit: serviceDraft.unit.trim() || 'Stunde',
      unitPrice: serviceDraft.unitPrice ?? 0,
      vatRate: serviceDraft.vatRate ?? 19,
      category: serviceDraft.category.trim() || undefined,
    });
    serviceDraft = emptyDraft();
    addingService = false;
  }

  function commitEditService() {
    if (!editingServiceId || !editDraft.name.trim()) { editingServiceId = null; return; }
    updateService(editingServiceId, {
      name: editDraft.name.trim(),
      description: editDraft.description.trim(),
      unit: editDraft.unit.trim() || 'Stunde',
      unitPrice: editDraft.unitPrice ?? 0,
      vatRate: editDraft.vatRate ?? 19,
      category: editDraft.category.trim() || undefined,
    });
    editingServiceId = null;
  }

  // Group services by category
  $: serviceGroups = (() => {
    const groups: Record<string, ServiceItem[]> = {};
    for (const s of services) {
      const key = s.category || 'Allgemein';
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
    return groups;
  })();
</script>

<div class="flex-1 grid overflow-hidden" style="grid-template-columns: 240px 1fr">
  <!-- Left panel -->
  <div class="border-r border-border flex flex-col overflow-hidden">
    <div class="flex items-center gap-[2px] p-4 flex-shrink-0">
      <button
        class="flex-1 px-2 py-1 text-[12px] font-medium rounded-lg transition-colors whitespace-nowrap {activeTab === 'projects' ? 'bg-accent-subtle text-accent' : 'text-secondary hover:bg-bg hover:text-primary'}"
        on:click={() => activeTab = 'projects'}
      >Projekte</button>
      <button
        class="flex-1 px-2 py-1 text-[12px] font-medium rounded-lg transition-colors whitespace-nowrap {activeTab === 'recurring' ? 'bg-accent-subtle text-accent' : 'text-secondary hover:bg-bg hover:text-primary'}"
        on:click={() => activeTab = 'recurring'}
      >↺ Wiederholt</button>
    </div>

    <!-- ── Wiederholt ── -->
    {#if activeTab === 'recurring'}
      <div class="px-3 overflow-y-auto flex-1">
        <RecurringTasksPanel />
      </div>

    <!-- ── Projekte list ── -->
    {:else}
      <div class="flex items-center justify-between px-4 pb-2 flex-shrink-0">
        <span class="text-[11px] text-muted">&nbsp;</span>
        <button
          class="w-6 h-6 flex items-center justify-center rounded-lg text-muted text-lg hover:bg-bg hover:text-primary transition-colors"
          on:click={() => addingClientSource = 'left'}
          title="Neuer Kunde"
        >+</button>
      </div>
      <div class="flex-1 overflow-y-auto px-3 pb-4 flex flex-col gap-1">
        {#if clients.length === 0 && !addingClient}
          <p class="text-[13px] text-muted leading-relaxed px-2 py-4">Noch keine Kunden. Füge deinen ersten Kunden hinzu.</p>
        {/if}

        {#each clients as client (client.id)}
          {@const cp = projects.filter(p => p.clientId === client.id)}
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

            {#each cp as project (project.id)}
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

        {#if addingClientSource === 'left'}
          <form class="py-1" on:submit={handleAddClient}>
            <!-- svelte-ignore a11y-autofocus -->
            <input
              class="w-full px-2 py-[5px] border border-accent rounded-lg text-[13px] outline-none bg-surface"
              bind:value={newClientName}
              placeholder="Kundenname..."
              autofocus
              on:keydown={(e) => { if (e.key === 'Escape') addingClientSource = null; }}
            />
          </form>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Right panel -->
  <div class="flex flex-col overflow-hidden">

    <!-- ── Kunden view ── -->
    {#if rightView === 'clients'}
      <div class="flex-1 overflow-hidden grid" style="grid-template-columns: 200px 1fr">
        <!-- Client list -->
        <div class="border-r border-border flex flex-col overflow-hidden">
          <div class="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
            <span class="text-[11px] text-muted">{clients.length} Kunden</span>
            <button
              class="w-6 h-6 flex items-center justify-center rounded-lg text-muted text-lg hover:bg-bg hover:text-primary transition-colors"
              on:click={() => { addingClientSource = 'right'; }}
              title="Neuer Kunde"
            >+</button>
          </div>
          <div class="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1">
            {#each clients as client (client.id)}
              <button
                class="flex items-center gap-2 py-[6px] px-2 rounded-lg w-full text-left transition-colors min-w-0 {selectedClientId === client.id ? 'bg-accent-subtle' : 'hover:bg-bg'}"
                on:click={() => selectedClientId = client.id}
              >
                <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{client.color}" />
                <span class="flex-1 text-[13px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 {selectedClientId === client.id ? 'text-accent font-medium' : 'text-primary'}">{client.name}</span>
                <span class="text-[11px] text-muted flex-shrink-0">{projects.filter(p => p.clientId === client.id).length}P</span>
              </button>
            {/each}
            {#if addingClientSource === 'right'}
              <form class="py-1" on:submit={handleAddClient}>
                <!-- svelte-ignore a11y-autofocus -->
                <input
                  class="w-full px-2 py-[5px] border border-accent rounded-lg text-[13px] outline-none bg-surface"
                  bind:value={newClientName}
                  placeholder="Kundenname..."
                  autofocus
                  on:keydown={(e) => { if (e.key === 'Escape') addingClientSource = null; }}
                />
              </form>
            {/if}
            {#if clients.length === 0 && !addingClient}
              <p class="text-[13px] text-muted px-2 py-4">Noch keine Kunden.</p>
            {/if}
          </div>
        </div>
        <!-- Client detail -->
        {#if !selectedClient}
          <div class="flex items-center justify-center text-muted text-sm">
            <p>Wähle einen Kunden aus.</p>
          </div>
        {:else}
          <div class="overflow-y-auto p-6 flex flex-col gap-6 max-w-2xl">
            <!-- Header row -->
            <div class="flex items-center gap-3 pb-4 border-b border-border">
              <span class="w-4 h-4 rounded-full flex-shrink-0" style="background:{selectedClient.color}" />
              <h2 class="text-base font-semibold text-primary flex-1">{selectedClient.name}</h2>
              <button
                class="px-3 py-1 text-red-500 border border-red-200 rounded-lg text-[12px] hover:bg-red-50 transition-colors"
                on:click={handleDeleteClient}
              >Löschen</button>
            </div>

            <!-- Color picker -->
            <div class="flex gap-1 flex-wrap">
              {#each PROJECT_COLORS as c (c)}
                <button
                  class="w-[18px] h-[18px] rounded-full transition-transform hover:scale-[1.15] {selectedClient.color === c ? 'ring-2 ring-secondary ring-offset-2' : ''}"
                  style="background:{c}"
                  on:click={() => updateClient(selectedClient.id, { color: c })}
                  aria-label="Farbe {c}"
                />
              {/each}
            </div>

            <!-- Contact fields -->
            <div class="grid grid-cols-2 gap-3">
              <label class="flex flex-col gap-1 col-span-2">
                <span class="text-xs text-muted font-medium">Kundenname</span>
                <input class="input" value={selectedClient.name} on:input={onClientStr('name')} />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs text-muted font-medium">Ansprechpartner</span>
                <input class="input" value={selectedClient.contactPerson ?? ''} placeholder="Max Mustermann" on:input={onClientStr('contactPerson')} />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs text-muted font-medium">E-Mail</span>
                <input class="input" type="email" value={selectedClient.email ?? ''} placeholder="kontakt@firma.de" on:input={onClientStr('email')} />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs text-muted font-medium">Telefon</span>
                <input class="input" value={selectedClient.phone ?? ''} placeholder="+49 30 …" on:input={onClientStr('phone')} />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs text-muted font-medium">Stundensatz (€)</span>
                <input class="input" type="number" value={selectedClient.hourlyRate ?? ''} placeholder="95" on:input={onClientNum('hourlyRate')} />
              </label>
              <label class="flex flex-col gap-1 col-span-2">
                <span class="text-xs text-muted font-medium">Adresse</span>
                <input class="input" value={selectedClient.address ?? ''} placeholder="Musterstraße 1, 10115 Berlin" on:input={onClientStr('address')} />
              </label>
              <label class="flex flex-col gap-1 col-span-2">
                <span class="text-xs text-muted font-medium">Notizen</span>
                <textarea class="input resize-y min-h-[80px] font-mono leading-relaxed" value={selectedClient.notes ?? ''} placeholder="Zugänge, Besonderheiten, Ansprechpartner-Info…" on:input={onClientStr('notes')} rows={4} />
              </label>
            </div>

            <!-- Projects of this client -->
            {#if clientProjects.length > 0}
              <div class="flex flex-col gap-2">
                <h3 class="text-[11px] font-bold uppercase tracking-widest text-muted">Projekte</h3>
                {#each clientProjects as p (p.id)}
                  <button
                    class="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-bg text-left transition-colors"
                    on:click={() => { projectsViewStore.set('project'); selectedProjectIdStore.set(p.id); }}
                  >
                    <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{p.color}" />
                    <span class="flex-1 text-[13px] text-primary">{p.name}</span>
                    <span class="text-[11px] text-muted capitalize">{p.status}</span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>

    <!-- ── Leistungen view ── -->
    {:else if rightView === 'services'}
      <div class="flex-1 overflow-y-auto p-6 flex flex-col gap-6 max-w-2xl">
        <!-- Edit form -->
        {#if editingService}
          <div class="flex flex-col gap-4 p-4 rounded-xl border border-accent bg-accent/5">
            <h3 class="text-sm font-semibold text-primary">Leistung bearbeiten</h3>
            <div class="grid grid-cols-2 gap-3">
              <label class="flex flex-col gap-1 col-span-2">
                <span class="text-xs text-muted font-medium">Kurzbezeichnung *</span>
                <input class="input" bind:value={editDraft.name} placeholder="Webentwicklung" />
              </label>
              <label class="flex flex-col gap-1 col-span-2">
                <span class="text-xs text-muted font-medium">Rechnungstext (Langtext)</span>
                <textarea class="input resize-none" bind:value={editDraft.description} rows={2} placeholder="Entwicklung und Implementierung…" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs text-muted font-medium">Einheit</span>
                <input class="input" bind:value={editDraft.unit} placeholder="Stunde" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs text-muted font-medium">Einzelpreis (€)</span>
                <input class="input" type="number" step="0.01" bind:value={editDraft.unitPrice} placeholder="95.00" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs text-muted font-medium">MwSt. (%)</span>
                <input class="input" type="number" bind:value={editDraft.vatRate} placeholder="19" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs text-muted font-medium">Kategorie</span>
                <input class="input" bind:value={editDraft.category} placeholder="Entwicklung" />
              </label>
            </div>
            <div class="flex gap-2">
              <button
                class="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
                on:click={commitEditService}
              >Speichern</button>
              <button
                class="px-4 py-2 rounded-lg border border-border text-secondary text-sm hover:bg-bg transition-colors"
                on:click={() => editingServiceId = null}
              >Abbrechen</button>
              <button
                class="ml-auto px-3 py-2 rounded-lg text-red-500 border border-red-200 text-sm hover:bg-red-50 transition-colors"
                on:click={() => { if (editingServiceId) removeService(editingServiceId); editingServiceId = null; }}
              >Löschen</button>
            </div>
          </div>

        <!-- Add form -->
        {:else if addingService}
          <div class="flex flex-col gap-4 p-4 rounded-xl border border-accent bg-accent/5">
            <h3 class="text-sm font-semibold text-primary">Neue Leistung</h3>
            <div class="grid grid-cols-2 gap-3">
              <label class="flex flex-col gap-1 col-span-2">
                <span class="text-xs text-muted font-medium">Kurzbezeichnung *</span>
                <!-- svelte-ignore a11y-autofocus -->
                <input class="input" bind:value={serviceDraft.name} placeholder="Webentwicklung" autofocus />
              </label>
              <label class="flex flex-col gap-1 col-span-2">
                <span class="text-xs text-muted font-medium">Rechnungstext (Langtext)</span>
                <textarea class="input resize-none" bind:value={serviceDraft.description} rows={2} placeholder="Entwicklung und Implementierung…" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs text-muted font-medium">Einheit</span>
                <input class="input" bind:value={serviceDraft.unit} placeholder="Stunde" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs text-muted font-medium">Einzelpreis (€)</span>
                <input class="input" type="number" step="0.01" bind:value={serviceDraft.unitPrice} placeholder="95.00" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs text-muted font-medium">MwSt. (%)</span>
                <input class="input" type="number" bind:value={serviceDraft.vatRate} placeholder="19" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs text-muted font-medium">Kategorie</span>
                <input class="input" bind:value={serviceDraft.category} placeholder="Entwicklung" />
              </label>
            </div>
            <div class="flex gap-2">
              <button
                class="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
                on:click={saveService}
              >Hinzufügen</button>
              <button
                class="px-4 py-2 rounded-lg border border-border text-secondary text-sm hover:bg-bg transition-colors"
                on:click={() => { addingService = false; serviceDraft = emptyDraft(); }}
              >Abbrechen</button>
            </div>
          </div>

        {:else}
          <!-- Service list -->
          {#if services.length === 0}
            <div class="flex flex-col items-center justify-center py-16 text-center gap-3">
              <span class="text-3xl text-muted">◻</span>
              <p class="text-sm font-medium text-primary">Noch keine Leistungen</p>
              <p class="text-[13px] text-muted max-w-xs">Lege Leistungsvorlagen an, um sie bei der Rechnungserstellung schnell auswählen zu können.</p>
              <button
                class="mt-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
                on:click={() => { addingService = true; serviceDraft = emptyDraft(); }}
              >Erste Leistung anlegen</button>
            </div>
          {:else}
            <div class="flex justify-end mb-2">
              <button
                class="px-3 py-1 text-[12px] font-medium rounded-lg border border-border text-secondary hover:bg-bg hover:text-primary transition-colors"
                on:click={() => { addingService = true; serviceDraft = emptyDraft(); }}
              >+ Neue Leistung</button>
            </div>
            <div class="flex flex-col gap-4">
              {#each Object.entries(serviceGroups) as [cat, items] (cat)}
                <div class="flex flex-col gap-1">
                  <p class="text-[10px] font-bold uppercase tracking-widest text-muted pb-1 border-b border-border">{cat}</p>
                  {#each items as s (s.id)}
                    <button
                      class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bg text-left transition-colors border border-transparent hover:border-border"
                      on:click={() => startEditService(s)}
                    >
                      <div class="flex-1 min-w-0">
                        <p class="text-[13px] font-medium text-primary">{s.name}</p>
                        {#if s.description}
                          <p class="text-[12px] text-muted truncate">{s.description}</p>
                        {/if}
                      </div>
                      <div class="text-right flex-shrink-0">
                        <p class="text-[13px] font-medium text-primary">{s.unitPrice.toFixed(2)} €</p>
                        <p class="text-[11px] text-muted">pro {s.unit} · {s.vatRate} % MwSt.</p>
                      </div>
                      <span class="text-muted text-sm">✎</span>
                    </button>
                  {/each}
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </div>

    <!-- ── Projekte detail ── -->
    {:else}
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
    {/if}
  </div>
</div>

<style>
  .input {
    width: 100%;
    padding: 6px 10px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    color: var(--color-text-primary);
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
  }
  .input:focus {
    border-color: var(--color-accent);
  }
</style>
