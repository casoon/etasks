<script lang="ts">
  import {
    $clients as clientsStore, $projects as projectsStore,
    addClient, updateClient, removeClient,
  } from '../stores/projectStore';
  import { $tasks as tasksStore } from '../stores/taskStore';
  import { $services as servicesStore, addService, updateService, removeService } from '../stores/serviceStore';
  import { $invoices as invoicesStore, addInvoice, updateInvoice, removeInvoice } from '../stores/invoiceStore';
  import { $appConfig as appConfigStore, saveAppConfig } from '../stores/configStore';
  import { PROJECT_COLORS } from '../domain/types';
  import type { Invoice, InvoiceLineItem, InvoiceStatus, ServiceItem, Client } from '../domain/types';

  $: clients = $clientsStore;
  $: projects = $projectsStore;
  $: tasks = $tasksStore;
  $: services = $servicesStore;
  $: invoices = $invoicesStore;
  $: appConfig = $appConfigStore;

  type RightView = 'invoice' | 'clients' | 'services';
  let rightView: RightView = 'invoice';

  let selectedInvoiceId: string | null = null;
  $: selectedInvoice = selectedInvoiceId ? invoices.find(i => i.id === selectedInvoiceId) ?? null : null;

  $: invoicesByClient = (() => {
    const clientMap = new Map(clients.map(c => [c.id, c]));
    const groups = new Map<string, { client: (typeof clients)[0] | null; invs: Invoice[] }>();
    for (const inv of invoices) {
      const key = inv.clientId || '__none';
      if (!groups.has(key)) groups.set(key, { client: clientMap.get(key) ?? null, invs: [] });
      groups.get(key)!.invs.push(inv);
    }
    return [...groups.values()]
      .map(g => ({ ...g, invs: g.invs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }))
      .sort((a, b) => (!a.client ? 1 : !b.client ? -1 : a.client.name.localeCompare(b.client.name)));
  })();

  $: otherInvoiceTaskIds = new Set(
    invoices.filter(i => i.id !== selectedInvoiceId).flatMap(i => i.lineItems.flatMap(li => li.taskIds))
  );
  $: clientTasksForInvoice = (() => {
    if (!selectedInvoice?.clientId) return [];
    return tasks.filter(t => {
      const proj = projects.find(p => p.id === t.projectId);
      return proj?.clientId === selectedInvoice!.clientId;
    });
  })();
  $: availableClientTasks = clientTasksForInvoice.filter(t => !otherInvoiceTaskIds.has(t.id));

  let newItemInput = '';
  let showNewItemSuggestions = false;
  $: newItemSuggestions = newItemInput.trim().length >= 1
    ? services.filter(s => s.name.toLowerCase().includes(newItemInput.toLowerCase()))
    : [];

  let taskPickerForLineItem: string | null = null;
  let lineItemDebounce: Record<string, ReturnType<typeof setTimeout>> = {};

  $: invoiceTotals = selectedInvoice ? calcTotals(selectedInvoice.lineItems) : null;

  function calcTotals(lineItems: InvoiceLineItem[]) {
    const vatMap: Record<number, number> = {};
    let netto = 0;
    for (const li of lineItems) {
      const lineNetto = li.unitPrice * li.quantity;
      netto += lineNetto;
      if (!vatMap[li.vatRate]) vatMap[li.vatRate] = 0;
      vatMap[li.vatRate] += lineNetto;
    }
    const vatEntries = Object.entries(vatMap).map(([rate, base]) => ({
      rate: Number(rate), amount: base * (Number(rate) / 100),
    }));
    return { netto, vatEntries, total: netto + vatEntries.reduce((s, v) => s + v.amount, 0) };
  }

  async function createNewInvoice() {
    const config = appConfig;
    const prefix = config?.profile.invoice_number_prefix ?? 'RE-';
    const counter = config?.profile.invoice_number_counter ?? 1;
    const dueD = new Date();
    dueD.setDate(dueD.getDate() + (config?.profile.payment_days ?? 14));
    const inv = addInvoice({
      clientId: '', invoiceNumber: prefix + String(counter).padStart(3, '0'),
      date: new Date().toISOString().slice(0, 10),
      dueDate: dueD.toISOString().slice(0, 10), status: 'draft', lineItems: [],
    });
    if (config) {
      await saveAppConfig({ ...config, profile: { ...config.profile, invoice_number_counter: counter + 1 } });
    }
    selectedInvoiceId = inv.id; rightView = 'invoice';
    newItemInput = ''; taskPickerForLineItem = null;
  }

  function deleteSelectedInvoice() {
    if (!selectedInvoice) return;
    if (confirm('Rechnung "' + selectedInvoice.invoiceNumber + '" wirklich löschen?')) {
      removeInvoice(selectedInvoice.id); selectedInvoiceId = null;
    }
  }

  function handleInvoiceClientSelect(e: Event) {
    if (!selectedInvoice) return;
    updateInvoice(selectedInvoice.id, { clientId: (e.currentTarget as HTMLSelectElement).value });
  }
  function handleInvoiceStatusSelect(e: Event) {
    if (!selectedInvoice) return;
    updateInvoice(selectedInvoice.id, { status: (e.currentTarget as HTMLSelectElement).value as InvoiceStatus });
  }
  function handleInvoiceNumberInput(e: Event) {
    if (!selectedInvoice) return;
    updateInvoice(selectedInvoice.id, { invoiceNumber: (e.currentTarget as HTMLInputElement).value });
  }
  function handleInvoiceDateInput(field: 'date' | 'dueDate') {
    return (e: Event) => {
      if (!selectedInvoice) return;
      updateInvoice(selectedInvoice.id, { [field]: (e.currentTarget as HTMLInputElement).value });
    };
  }
  function handleInvoiceNotesInput(e: Event) {
    if (!selectedInvoice) return;
    updateInvoice(selectedInvoice.id, { notes: (e.currentTarget as HTMLTextAreaElement).value });
  }

  function patchLineItem(lineItemId: string, patch: Partial<InvoiceLineItem>) {
    if (!selectedInvoice) return;
    updateInvoice(selectedInvoice.id, {
      lineItems: selectedInvoice.lineItems.map(li => li.id === lineItemId ? { ...li, ...patch } : li),
    });
  }
  function onLineItemStr(lineItemId: string, field: keyof InvoiceLineItem) {
    return (e: Event) => {
      const val = (e.currentTarget as HTMLInputElement | HTMLTextAreaElement).value;
      const key = lineItemId + ':' + String(field);
      clearTimeout(lineItemDebounce[key]);
      lineItemDebounce[key] = setTimeout(() => patchLineItem(lineItemId, { [field]: val } as Partial<InvoiceLineItem>), 400);
    };
  }
  function onLineItemNum(lineItemId: string, field: keyof InvoiceLineItem) {
    return (e: Event) => {
      patchLineItem(lineItemId, { [field]: parseFloat((e.currentTarget as HTMLInputElement).value) || 0 } as Partial<InvoiceLineItem>);
    };
  }

  function addFreeTextLineItem() {
    if (!selectedInvoice || !newItemInput.trim()) return;
    const item: InvoiceLineItem = {
      id: crypto.randomUUID(), name: newItemInput.trim(), description: '', unit: 'Stunde',
      unitPrice: 0, quantity: 1, vatRate: appConfig?.profile.default_vat_rate ?? 19, taskIds: [],
    };
    updateInvoice(selectedInvoice.id, { lineItems: [...selectedInvoice.lineItems, item] });
    newItemInput = ''; showNewItemSuggestions = false;
  }
  function addCatalogLineItem(svc: ServiceItem) {
    if (!selectedInvoice) return;
    const item: InvoiceLineItem = {
      id: crypto.randomUUID(), serviceItemId: svc.id,
      name: svc.name, description: svc.description, unit: svc.unit,
      unitPrice: svc.unitPrice, quantity: 1, vatRate: svc.vatRate, taskIds: [],
    };
    updateInvoice(selectedInvoice.id, { lineItems: [...selectedInvoice.lineItems, item] });
    newItemInput = ''; showNewItemSuggestions = false;
  }
  function removeLineItem(lineItemId: string) {
    if (!selectedInvoice) return;
    updateInvoice(selectedInvoice.id, { lineItems: selectedInvoice.lineItems.filter(li => li.id !== lineItemId) });
    if (taskPickerForLineItem === lineItemId) taskPickerForLineItem = null;
  }

  function assignTaskToLineItem(taskId: string, lineItemId: string) {
    if (!selectedInvoice) return;
    updateInvoice(selectedInvoice.id, {
      lineItems: selectedInvoice.lineItems.map(li => {
        if (li.id === lineItemId) return { ...li, taskIds: [...li.taskIds.filter(id => id !== taskId), taskId] };
        return { ...li, taskIds: li.taskIds.filter(id => id !== taskId) };
      }),
    });
    taskPickerForLineItem = null;
  }
  function removeTaskFromLineItem(taskId: string, lineItemId: string) {
    if (!selectedInvoice) return;
    patchLineItem(lineItemId, {
      taskIds: (selectedInvoice.lineItems.find(li => li.id === lineItemId)?.taskIds ?? []).filter(id => id !== taskId),
    });
  }

  function getTaskById(id: string) { return tasks.find(t => t.id === id); }
  function getProjectName(projectId?: string) { return projectId ? (projects.find(p => p.id === projectId)?.name ?? '') : ''; }
  function lineItemTotal(li: InvoiceLineItem) { return (li.unitPrice * li.quantity).toFixed(2); }
  function statusLabel(s: InvoiceStatus) { return s === 'draft' ? 'Entwurf' : s === 'sent' ? 'Gesendet' : 'Bezahlt'; }
  function statusBadgeClass(s: InvoiceStatus) {
    return s === 'draft' ? 'bg-gray-100 text-gray-600' : s === 'sent' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700';
  }

  // ── Kunden sub-view ───────────────────────────────────────────────────
  let selectedClientId: string | null = null;
  $: selectedClient = selectedClientId ? clients.find(c => c.id === selectedClientId) ?? null : null;
  $: clientProjects = selectedClientId ? projects.filter(p => p.clientId === selectedClientId) : [];
  let addingClient = false;
  let newClientName = '';
  let clientFieldDebounce: ReturnType<typeof setTimeout> | null = null;

  function handleAddClient(e: Event) {
    e.preventDefault();
    if (!newClientName.trim()) return;
    addClient(newClientName.trim());
    newClientName = ''; addingClient = false;
  }
  function handleDeleteClient() {
    if (!selectedClient) return;
    if (confirm('Kunden "' + selectedClient.name + '" löschen?')) {
      removeClient(selectedClient.id); selectedClientId = null;
    }
  }
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
      const value = parseFloat((e.currentTarget as HTMLInputElement).value) || undefined;
      if (clientFieldDebounce) clearTimeout(clientFieldDebounce);
      clientFieldDebounce = setTimeout(() => updateClient(selectedClientId!, { [field]: value } as Partial<Client>), 400);
    };
  }

  // ── Leistungen sub-view ───────────────────────────────────────────────
  let addingService = false;
  let editingServiceId: string | null = null;
  $: editingService = editingServiceId ? (services.find(x => x.id === editingServiceId) ?? null) : null;

  interface ServiceDraft {
    name: string; description: string; unit: string;
    unitPrice: number | null; vatRate: number | null; category: string;
  }
  const emptyDraft = (): ServiceDraft => ({ name: '', description: '', unit: 'Stunde', unitPrice: null, vatRate: 19, category: '' });
  let serviceDraft: ServiceDraft = emptyDraft();
  let editDraft: ServiceDraft = emptyDraft();

  function startEditService(s: ServiceItem) {
    editingServiceId = s.id;
    editDraft = { name: s.name, description: s.description, unit: s.unit, unitPrice: s.unitPrice, vatRate: s.vatRate, category: s.category ?? '' };
  }
  function saveService() {
    if (!serviceDraft.name.trim()) return;
    addService({ name: serviceDraft.name.trim(), description: serviceDraft.description.trim(), unit: serviceDraft.unit.trim() || 'Stunde', unitPrice: serviceDraft.unitPrice ?? 0, vatRate: serviceDraft.vatRate ?? 19, category: serviceDraft.category.trim() || undefined });
    serviceDraft = emptyDraft(); addingService = false;
  }
  function commitEditService() {
    if (!editingServiceId || !editDraft.name.trim()) { editingServiceId = null; return; }
    updateService(editingServiceId, { name: editDraft.name.trim(), description: editDraft.description.trim(), unit: editDraft.unit.trim() || 'Stunde', unitPrice: editDraft.unitPrice ?? 0, vatRate: editDraft.vatRate ?? 19, category: editDraft.category.trim() || undefined });
    editingServiceId = null;
  }
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

<div class="flex-1 grid overflow-hidden" style="grid-template-columns: 260px 1fr">

  <!-- Left panel: invoice list -->
  <div class="border-r border-border flex flex-col overflow-hidden">
    <div class="px-4 py-3 flex-shrink-0 border-b border-border">
      <button
        class="w-full px-3 py-2 rounded-lg bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity"
        on:click={createNewInvoice}
      >+ Neue Rechnung</button>
    </div>
    <div class="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1">
      {#if invoices.length === 0}
        <p class="text-[13px] text-muted px-2 py-4 leading-relaxed">Noch keine Rechnungen.</p>
      {/if}
      {#each invoicesByClient as group (group.client?.id ?? '__none')}
        <p class="text-[10px] font-bold uppercase tracking-widest text-muted px-2 pt-3 pb-1">
          {group.client?.name ?? 'Ohne Kunde'}
        </p>
        {#each group.invs as inv (inv.id)}
          <button
            class="flex items-center gap-2 py-[6px] px-2 rounded-lg w-full text-left transition-colors min-w-0 {selectedInvoiceId === inv.id && rightView === 'invoice' ? 'bg-accent-subtle' : 'hover:bg-bg'}"
            on:click={() => { selectedInvoiceId = inv.id; rightView = 'invoice'; taskPickerForLineItem = null; }}
          >
            <div class="flex-1 min-w-0">
              <p class="text-[12px] font-mono overflow-hidden text-ellipsis whitespace-nowrap {selectedInvoiceId === inv.id && rightView === 'invoice' ? 'text-accent font-semibold' : 'text-primary'}">{inv.invoiceNumber}</p>
              <p class="text-[11px] text-muted">{inv.date}</p>
            </div>
            <span class="text-[10px] px-[6px] py-[2px] rounded-full flex-shrink-0 {statusBadgeClass(inv.status)}">{statusLabel(inv.status)}</span>
          </button>
        {/each}
      {/each}
    </div>
  </div>

  <!-- Right panel -->
  <div class="flex flex-col overflow-hidden">

    <!-- Top bar -->
    <div class="flex items-center justify-between px-4 border-b border-border flex-shrink-0 h-[44px]">
      {#if rightView !== 'invoice'}
        <button class="flex items-center gap-1 text-[13px] text-secondary hover:text-primary transition-colors" on:click={() => rightView = 'invoice'}>← Rechnungen</button>
      {:else}
        <div />
      {/if}
      <div class="flex gap-1">
        <button class="px-3 py-1 text-[12px] font-medium rounded-lg transition-colors {rightView === 'clients' ? 'bg-accent-subtle text-accent' : 'text-secondary hover:bg-bg hover:text-primary'}" on:click={() => rightView = 'clients'}>Kunden</button>
        <button class="px-3 py-1 text-[12px] font-medium rounded-lg transition-colors {rightView === 'services' ? 'bg-accent-subtle text-accent' : 'text-secondary hover:bg-bg hover:text-primary'}" on:click={() => rightView = 'services'}>Leistungen</button>
      </div>
    </div>

    <!-- ── Kunden sub-view ── -->
    {#if rightView === 'clients'}
      <div class="flex-1 overflow-hidden grid" style="grid-template-columns: 200px 1fr">
        <div class="border-r border-border flex flex-col overflow-hidden">
          <div class="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
            <span class="text-[11px] text-muted">{clients.length} Kunden</span>
            <button class="w-6 h-6 flex items-center justify-center rounded-lg text-muted text-lg hover:bg-bg hover:text-primary transition-colors" on:click={() => { addingClient = true; }}>+</button>
          </div>
          <div class="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1">
            {#each clients as client (client.id)}
              <button
                class="flex items-center gap-2 py-[6px] px-2 rounded-lg w-full text-left transition-colors min-w-0 {selectedClientId === client.id ? 'bg-accent-subtle' : 'hover:bg-bg'}"
                on:click={() => selectedClientId = client.id}
              >
                <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{client.color}" />
                <span class="flex-1 text-[13px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 {selectedClientId === client.id ? 'text-accent font-medium' : 'text-primary'}">{client.name}</span>
              </button>
            {/each}
            {#if addingClient}
              <form class="py-1" on:submit={handleAddClient}>
                <!-- svelte-ignore a11y-autofocus -->
                <input class="w-full px-2 py-[5px] border border-accent rounded-lg text-[13px] outline-none bg-surface" bind:value={newClientName} placeholder="Kundenname..." autofocus on:keydown={(e) => { if (e.key === 'Escape') addingClient = false; }} />
              </form>
            {/if}
            {#if clients.length === 0 && !addingClient}
              <p class="text-[13px] text-muted px-2 py-4">Noch keine Kunden.</p>
            {/if}
          </div>
        </div>
        {#if !selectedClient}
          <div class="flex items-center justify-center text-muted text-sm"><p>Wähle einen Kunden aus.</p></div>
        {:else}
          <div class="overflow-y-auto p-6 flex flex-col gap-6 max-w-2xl">
            <div class="flex items-center gap-3 pb-4 border-b border-border">
              <span class="w-4 h-4 rounded-full flex-shrink-0" style="background:{selectedClient.color}" />
              <h2 class="text-base font-semibold text-primary flex-1">{selectedClient.name}</h2>
              <button class="px-3 py-1 text-red-500 border border-red-200 rounded-lg text-[12px] hover:bg-red-50 transition-colors" on:click={handleDeleteClient}>Löschen</button>
            </div>
            <div class="flex gap-1 flex-wrap">
              {#each PROJECT_COLORS as c (c)}
                <button class="w-[18px] h-[18px] rounded-full transition-transform hover:scale-[1.15] {selectedClient.color === c ? 'ring-2 ring-secondary ring-offset-2' : ''}" style="background:{c}" on:click={() => updateClient(selectedClient.id, { color: c })} aria-label="Farbe {c}" />
              {/each}
            </div>
            <div class="grid grid-cols-2 gap-3">
              <label class="flex flex-col gap-1 col-span-2"><span class="text-xs text-muted font-medium">Kundenname</span><input class="input" value={selectedClient.name} on:input={onClientStr('name')} /></label>
              <label class="flex flex-col gap-1"><span class="text-xs text-muted font-medium">Ansprechpartner</span><input class="input" value={selectedClient.contactPerson ?? ''} placeholder="Max Mustermann" on:input={onClientStr('contactPerson')} /></label>
              <label class="flex flex-col gap-1"><span class="text-xs text-muted font-medium">E-Mail</span><input class="input" type="email" value={selectedClient.email ?? ''} placeholder="kontakt@firma.de" on:input={onClientStr('email')} /></label>
              <label class="flex flex-col gap-1"><span class="text-xs text-muted font-medium">Telefon</span><input class="input" value={selectedClient.phone ?? ''} placeholder="+49 30 …" on:input={onClientStr('phone')} /></label>
              <label class="flex flex-col gap-1"><span class="text-xs text-muted font-medium">Stundensatz (€)</span><input class="input" type="number" value={selectedClient.hourlyRate ?? ''} placeholder="95" on:input={onClientNum('hourlyRate')} /></label>
              <label class="flex flex-col gap-1 col-span-2"><span class="text-xs text-muted font-medium">Adresse</span><input class="input" value={selectedClient.address ?? ''} placeholder="Musterstraße 1, 10115 Berlin" on:input={onClientStr('address')} /></label>
              <label class="flex flex-col gap-1 col-span-2"><span class="text-xs text-muted font-medium">Notizen</span><textarea class="input resize-y min-h-[80px] font-mono leading-relaxed" value={selectedClient.notes ?? ''} placeholder="Zugänge, Besonderheiten…" on:input={onClientStr('notes')} rows={3} /></label>
            </div>
            {#if clientProjects.length > 0}
              <div class="flex flex-col gap-2">
                <h3 class="text-[11px] font-bold uppercase tracking-widest text-muted">Projekte</h3>
                {#each clientProjects as p (p.id)}
                  <div class="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-bg">
                    <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{p.color}" />
                    <span class="flex-1 text-[13px] text-primary">{p.name}</span>
                    <span class="text-[11px] text-muted capitalize">{p.status}</span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>

    <!-- ── Leistungen sub-view ── -->
    {:else if rightView === 'services'}
      <div class="flex-1 overflow-y-auto p-6 flex flex-col gap-6 max-w-2xl">
        {#if editingService}
          <div class="flex flex-col gap-4 p-4 rounded-xl border border-accent bg-accent/5">
            <h3 class="text-sm font-semibold text-primary">Leistung bearbeiten</h3>
            <div class="grid grid-cols-2 gap-3">
              <label class="flex flex-col gap-1 col-span-2"><span class="text-xs text-muted font-medium">Kurzbezeichnung *</span><input class="input" bind:value={editDraft.name} placeholder="Webentwicklung" /></label>
              <label class="flex flex-col gap-1 col-span-2"><span class="text-xs text-muted font-medium">Rechnungstext</span><textarea class="input resize-none" bind:value={editDraft.description} rows={2} placeholder="Entwicklung und Implementierung…" /></label>
              <label class="flex flex-col gap-1"><span class="text-xs text-muted font-medium">Einheit</span><input class="input" bind:value={editDraft.unit} placeholder="Stunde" /></label>
              <label class="flex flex-col gap-1"><span class="text-xs text-muted font-medium">Einzelpreis (€)</span><input class="input" type="number" step="0.01" bind:value={editDraft.unitPrice} placeholder="95.00" /></label>
              <label class="flex flex-col gap-1"><span class="text-xs text-muted font-medium">MwSt. (%)</span><input class="input" type="number" bind:value={editDraft.vatRate} placeholder="19" /></label>
              <label class="flex flex-col gap-1"><span class="text-xs text-muted font-medium">Kategorie</span><input class="input" bind:value={editDraft.category} placeholder="Entwicklung" /></label>
            </div>
            <div class="flex gap-2">
              <button class="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90" on:click={commitEditService}>Speichern</button>
              <button class="px-4 py-2 rounded-lg border border-border text-secondary text-sm hover:bg-bg" on:click={() => editingServiceId = null}>Abbrechen</button>
              <button class="ml-auto px-3 py-2 rounded-lg text-red-500 border border-red-200 text-sm hover:bg-red-50" on:click={() => { if (editingServiceId) removeService(editingServiceId); editingServiceId = null; }}>Löschen</button>
            </div>
          </div>
        {:else if addingService}
          <div class="flex flex-col gap-4 p-4 rounded-xl border border-accent bg-accent/5">
            <h3 class="text-sm font-semibold text-primary">Neue Leistung</h3>
            <div class="grid grid-cols-2 gap-3">
              <label class="flex flex-col gap-1 col-span-2"><span class="text-xs text-muted font-medium">Kurzbezeichnung *</span><!-- svelte-ignore a11y-autofocus --><input class="input" bind:value={serviceDraft.name} placeholder="Webentwicklung" autofocus /></label>
              <label class="flex flex-col gap-1 col-span-2"><span class="text-xs text-muted font-medium">Rechnungstext</span><textarea class="input resize-none" bind:value={serviceDraft.description} rows={2} placeholder="Entwicklung und Implementierung…" /></label>
              <label class="flex flex-col gap-1"><span class="text-xs text-muted font-medium">Einheit</span><input class="input" bind:value={serviceDraft.unit} placeholder="Stunde" /></label>
              <label class="flex flex-col gap-1"><span class="text-xs text-muted font-medium">Einzelpreis (€)</span><input class="input" type="number" step="0.01" bind:value={serviceDraft.unitPrice} placeholder="95.00" /></label>
              <label class="flex flex-col gap-1"><span class="text-xs text-muted font-medium">MwSt. (%)</span><input class="input" type="number" bind:value={serviceDraft.vatRate} placeholder="19" /></label>
              <label class="flex flex-col gap-1"><span class="text-xs text-muted font-medium">Kategorie</span><input class="input" bind:value={serviceDraft.category} placeholder="Entwicklung" /></label>
            </div>
            <div class="flex gap-2">
              <button class="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90" on:click={saveService}>Hinzufügen</button>
              <button class="px-4 py-2 rounded-lg border border-border text-secondary text-sm hover:bg-bg" on:click={() => { addingService = false; serviceDraft = emptyDraft(); }}>Abbrechen</button>
            </div>
          </div>
        {:else}
          {#if services.length === 0}
            <div class="flex flex-col items-center justify-center py-16 text-center gap-3">
              <p class="text-sm font-medium text-primary">Noch keine Leistungen</p>
              <button class="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90" on:click={() => { addingService = true; serviceDraft = emptyDraft(); }}>Erste Leistung anlegen</button>
            </div>
          {:else}
            <div class="flex justify-end">
              <button class="px-3 py-1 text-[12px] font-medium rounded-lg border border-border text-secondary hover:bg-bg hover:text-primary transition-colors" on:click={() => { addingService = true; serviceDraft = emptyDraft(); }}>+ Neue Leistung</button>
            </div>
            <div class="flex flex-col gap-4">
              {#each Object.entries(serviceGroups) as [cat, items] (cat)}
                <div class="flex flex-col gap-1">
                  <p class="text-[10px] font-bold uppercase tracking-widest text-muted pb-1 border-b border-border">{cat}</p>
                  {#each items as s (s.id)}
                    <button class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bg text-left transition-colors border border-transparent hover:border-border" on:click={() => startEditService(s)}>
                      <div class="flex-1 min-w-0">
                        <p class="text-[13px] font-medium text-primary">{s.name}</p>
                        {#if s.description}<p class="text-[12px] text-muted truncate">{s.description}</p>{/if}
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

    <!-- ── Rechnungsansicht ── -->
    {:else}
      {#if !selectedInvoice}
        <div class="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <p class="text-muted text-sm">Wähle eine Rechnung oder erstelle eine neue.</p>
          <button class="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity" on:click={createNewInvoice}>+ Neue Rechnung erstellen</button>
        </div>
      {:else}
        <div class="flex-1 overflow-y-auto flex flex-col">

          <!-- Invoice header -->
          <div class="px-6 py-4 border-b border-border flex-shrink-0">
            <div class="flex items-center gap-2 flex-wrap">
              <select class="border border-border rounded-md px-2 py-[5px] text-[13px] bg-bg outline-none text-primary focus:border-accent flex-1 min-w-[160px]" value={selectedInvoice.clientId} on:change={handleInvoiceClientSelect}>
                <option value="">— Kein Kunde —</option>
                {#each clients as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
              </select>
              <input class="input font-mono w-[140px]" value={selectedInvoice.invoiceNumber} placeholder="RE-2026-001" on:input={handleInvoiceNumberInput} />
              <input class="input w-[130px]" type="date" value={selectedInvoice.date} on:input={handleInvoiceDateInput('date')} />
              <input class="input w-[130px]" type="date" value={selectedInvoice.dueDate} on:input={handleInvoiceDateInput('dueDate')} />
              <select class="border border-border rounded-md px-2 py-[5px] text-[12px] bg-bg outline-none text-secondary focus:border-accent" value={selectedInvoice.status} on:change={handleInvoiceStatusSelect}>
                <option value="draft">Entwurf</option>
                <option value="sent">Gesendet</option>
                <option value="paid">Bezahlt</option>
              </select>
            </div>
          </div>

          <!-- Positionen -->
          <div class="px-6 py-4 flex flex-col gap-3">
            <h3 class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">Positionen</h3>

            {#each selectedInvoice.lineItems as li (li.id)}
              <div class="flex flex-col gap-2 p-3 rounded-xl border border-border bg-surface">
                <div class="flex items-center gap-2">
                  {#if li.serviceItemId}
                    <div class="flex items-center gap-2 flex-1 min-w-0">
                      <span class="text-[10px] text-accent font-medium px-[6px] py-[1px] rounded-full bg-accent-subtle flex-shrink-0">🔒 Katalog</span>
                      <span class="text-[13px] font-medium text-primary overflow-hidden text-ellipsis whitespace-nowrap">{li.name}</span>
                    </div>
                  {:else}
                    <input class="input flex-1 min-w-0" value={li.name} placeholder="Bezeichnung" on:input={onLineItemStr(li.id, 'name')} />
                  {/if}
                  <span class="text-[13px] font-semibold text-primary tabular-nums flex-shrink-0">{lineItemTotal(li)} €</span>
                  <button class="w-6 h-6 flex items-center justify-center rounded text-muted hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0 text-sm" on:click={() => removeLineItem(li.id)}>×</button>
                </div>
                <input class="input text-[12px]" value={li.description} placeholder="Rechnungstext / Beschreibung (optional)" on:input={onLineItemStr(li.id, 'description')} />
                <div class="grid grid-cols-4 gap-2">
                  <label class="flex flex-col gap-1"><span class="text-[10px] text-muted font-medium uppercase tracking-wide">Einheit</span><input class="input text-[12px]" value={li.unit} placeholder="Stunde" on:input={onLineItemStr(li.id, 'unit')} /></label>
                  <label class="flex flex-col gap-1"><span class="text-[10px] text-muted font-medium uppercase tracking-wide">Einzelpreis (€)</span><input class="input text-[12px] tabular-nums" type="number" step="0.01" value={li.unitPrice} on:change={onLineItemNum(li.id, 'unitPrice')} /></label>
                  <label class="flex flex-col gap-1"><span class="text-[10px] text-muted font-medium uppercase tracking-wide">Menge</span><input class="input text-[12px] tabular-nums" type="number" step="0.5" value={li.quantity} on:change={onLineItemNum(li.id, 'quantity')} /></label>
                  <label class="flex flex-col gap-1"><span class="text-[10px] text-muted font-medium uppercase tracking-wide">MwSt. %</span><input class="input text-[12px] tabular-nums" type="number" value={li.vatRate} on:change={onLineItemNum(li.id, 'vatRate')} /></label>
                </div>
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-[10px] text-muted font-medium uppercase tracking-wide">Aufgaben:</span>
                  {#each li.taskIds as taskId (taskId)}
                    {@const t = getTaskById(taskId)}
                    {#if t}
                      <span class="flex items-center gap-1 px-2 py-[2px] rounded-full bg-bg border border-border text-[11px] text-secondary">
                        {t.title}
                        <button class="text-muted hover:text-red-500 ml-1 leading-none" on:click={() => removeTaskFromLineItem(taskId, li.id)}>×</button>
                      </span>
                    {/if}
                  {/each}
                  {#if selectedInvoice.clientId}
                    <button
                      class="px-2 py-[2px] rounded-full border border-dashed border-border text-[11px] text-muted hover:text-primary hover:border-accent transition-colors"
                      on:click={() => { taskPickerForLineItem = taskPickerForLineItem === li.id ? null : li.id; }}
                    >+ Aufgabe</button>
                  {/if}
                </div>
                {#if taskPickerForLineItem === li.id}
                  <div class="border border-border rounded-lg bg-bg overflow-hidden">
                    {#if availableClientTasks.length === 0}
                      <p class="text-[12px] text-muted px-3 py-2">Keine verfügbaren Aufgaben für diesen Kunden.</p>
                    {:else}
                      {#each availableClientTasks as t (t.id)}
                        <button
                          class="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface text-left border-b border-border last:border-b-0 transition-colors"
                          on:click={() => assignTaskToLineItem(t.id, li.id)}
                        >
                          <span class="flex-1 text-[12px] text-primary">{t.title}</span>
                          <span class="text-[11px] text-muted">{getProjectName(t.projectId)}</span>
                          <span class="text-[11px] text-muted tabular-nums">{t.duration}m</span>
                        </button>
                      {/each}
                    {/if}
                    <button class="w-full text-[11px] text-muted text-center py-2 hover:bg-surface border-t border-border" on:click={() => taskPickerForLineItem = null}>Schließen</button>
                  </div>
                {/if}
              </div>
            {/each}

            <!-- Add new line item -->
            <div class="relative">
              <div class="flex items-center gap-2 border border-dashed border-border rounded-xl px-3 py-2 focus-within:border-accent transition-colors">
                <input
                  class="flex-1 text-[13px] outline-none bg-transparent text-primary"
                  placeholder="+ Neue Position — Katalogsuche oder Freitext (Enter)"
                  bind:value={newItemInput}
                  on:focus={() => { showNewItemSuggestions = true; }}
                  on:blur={() => setTimeout(() => { showNewItemSuggestions = false; }, 150)}
                  on:keydown={(e) => { if (e.key === 'Enter') addFreeTextLineItem(); if (e.key === 'Escape') newItemInput = ''; }}
                />
                {#if newItemInput.trim()}
                  <button class="text-[12px] text-accent hover:underline flex-shrink-0" on:mousedown|preventDefault={addFreeTextLineItem}>Als Freitext</button>
                {/if}
              </div>
              {#if showNewItemSuggestions && newItemSuggestions.length > 0}
                <div class="absolute left-0 right-0 top-full z-10 bg-surface border border-border rounded-xl shadow-lg mt-1 overflow-hidden">
                  {#each newItemSuggestions as svc (svc.id)}
                    <button
                      class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-bg text-left border-b border-border last:border-b-0 transition-colors"
                      on:mousedown|preventDefault={() => addCatalogLineItem(svc)}
                    >
                      <div class="flex-1 min-w-0">
                        <p class="text-[13px] font-medium text-primary">{svc.name}</p>
                        {#if svc.description}<p class="text-[11px] text-muted truncate">{svc.description}</p>{/if}
                      </div>
                      <span class="text-[12px] text-muted flex-shrink-0 tabular-nums">{svc.unitPrice.toFixed(2)} €/{svc.unit}</span>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          </div>

          <!-- Totals -->
          {#if invoiceTotals && selectedInvoice.lineItems.length > 0}
            <div class="px-6 py-4 border-t border-border-subtle flex-shrink-0 flex flex-col gap-1 items-end">
              <div class="flex gap-8 text-[13px] text-secondary">
                <span>Netto</span>
                <span class="tabular-nums w-[100px] text-right">{invoiceTotals.netto.toFixed(2)} €</span>
              </div>
              {#each invoiceTotals.vatEntries as v (v.rate)}
                <div class="flex gap-8 text-[13px] text-secondary">
                  <span>MwSt. {v.rate} %</span>
                  <span class="tabular-nums w-[100px] text-right">{v.amount.toFixed(2)} €</span>
                </div>
              {/each}
              <div class="flex gap-8 text-[15px] font-bold text-primary border-t border-border mt-1 pt-2">
                <span>Gesamt</span>
                <span class="tabular-nums w-[100px] text-right">{invoiceTotals.total.toFixed(2)} €</span>
              </div>
            </div>
          {/if}

          <!-- Notes -->
          <div class="px-6 py-4 border-t border-border-subtle flex-shrink-0 flex flex-col gap-2">
            <label class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">Anmerkungen</label>
            <textarea
              class="w-full px-3 py-2 border border-border rounded-lg text-[13px] resize-y outline-none bg-bg text-primary focus:border-accent"
              value={selectedInvoice.notes ?? ''}
              placeholder="Interne Notizen oder zusätzlicher Rechnungstext..."
              rows={2}
              on:input={handleInvoiceNotesInput}
            />
          </div>

          <!-- Delete -->
          <div class="px-6 py-4 border-t border-border-subtle flex-shrink-0">
            <button class="px-3 py-1 text-red-500 border border-red-200 rounded-lg text-[12px] hover:bg-red-50 transition-colors" on:click={deleteSelectedInvoice}>Rechnung löschen</button>
          </div>

        </div>
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
