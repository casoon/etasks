<script lang="ts">
  import { $services as servicesStore, addService, updateService, removeService } from '../stores/serviceStore';
  import type { ServiceItem } from '../domain/types';

  $: services = $servicesStore;

  let addingService = false;
  let editingServiceId: string | null = null;
  $: editingService = editingServiceId ? services.find((x) => x.id === editingServiceId) ?? null : null;

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
      name: s.name,
      description: s.description,
      unit: s.unit,
      unitPrice: s.unitPrice,
      vatRate: s.vatRate,
      category: s.category ?? '',
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
    if (!editingServiceId || !editDraft.name.trim()) {
      editingServiceId = null;
      return;
    }
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

<div class="flex-1 overflow-y-auto p-6 flex flex-col gap-6 max-w-2xl">
  {#if editingService}
    <div class="flex flex-col gap-4 p-4 rounded-xl border border-accent bg-accent/5">
      <h3 class="text-sm font-semibold text-primary">Leistung bearbeiten</h3>
      <div class="grid grid-cols-2 gap-3">
        <label class="flex flex-col gap-1 col-span-2"><span class="text-xs text-muted font-medium">Kurzbezeichnung *</span><input class="input" bind:value={editDraft.name} placeholder="Webentwicklung" /></label>
        <label class="flex flex-col gap-1 col-span-2"><span class="text-xs text-muted font-medium">Rechnungstext (Langtext)</span><textarea class="input resize-none" bind:value={editDraft.description} rows={2} placeholder="Entwicklung und Implementierung…" /></label>
        <label class="flex flex-col gap-1"><span class="text-xs text-muted font-medium">Einheit</span><input class="input" bind:value={editDraft.unit} placeholder="Stunde" /></label>
        <label class="flex flex-col gap-1"><span class="text-xs text-muted font-medium">Einzelpreis (€)</span><input class="input" type="number" step="0.01" bind:value={editDraft.unitPrice} placeholder="95.00" /></label>
        <label class="flex flex-col gap-1"><span class="text-xs text-muted font-medium">MwSt. (%)</span><input class="input" type="number" bind:value={editDraft.vatRate} placeholder="19" /></label>
        <label class="flex flex-col gap-1"><span class="text-xs text-muted font-medium">Kategorie</span><input class="input" bind:value={editDraft.category} placeholder="Entwicklung" /></label>
      </div>
      <div class="flex gap-2">
        <button class="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity" on:click={commitEditService}>Speichern</button>
        <button class="px-4 py-2 rounded-lg border border-border text-secondary text-sm hover:bg-bg transition-colors" on:click={() => editingServiceId = null}>Abbrechen</button>
        <button class="ml-auto px-3 py-2 rounded-lg text-red-500 border border-red-200 text-sm hover:bg-red-50 transition-colors" on:click={() => { if (editingServiceId) removeService(editingServiceId); editingServiceId = null; }}>Löschen</button>
      </div>
    </div>
  {:else if addingService}
    <div class="flex flex-col gap-4 p-4 rounded-xl border border-accent bg-accent/5">
      <h3 class="text-sm font-semibold text-primary">Neue Leistung</h3>
      <div class="grid grid-cols-2 gap-3">
        <label class="flex flex-col gap-1 col-span-2"><span class="text-xs text-muted font-medium">Kurzbezeichnung *</span><!-- svelte-ignore a11y-autofocus --><input class="input" bind:value={serviceDraft.name} placeholder="Webentwicklung" autofocus /></label>
        <label class="flex flex-col gap-1 col-span-2"><span class="text-xs text-muted font-medium">Rechnungstext (Langtext)</span><textarea class="input resize-none" bind:value={serviceDraft.description} rows={2} placeholder="Entwicklung und Implementierung…" /></label>
        <label class="flex flex-col gap-1"><span class="text-xs text-muted font-medium">Einheit</span><input class="input" bind:value={serviceDraft.unit} placeholder="Stunde" /></label>
        <label class="flex flex-col gap-1"><span class="text-xs text-muted font-medium">Einzelpreis (€)</span><input class="input" type="number" step="0.01" bind:value={serviceDraft.unitPrice} placeholder="95.00" /></label>
        <label class="flex flex-col gap-1"><span class="text-xs text-muted font-medium">MwSt. (%)</span><input class="input" type="number" bind:value={serviceDraft.vatRate} placeholder="19" /></label>
        <label class="flex flex-col gap-1"><span class="text-xs text-muted font-medium">Kategorie</span><input class="input" bind:value={serviceDraft.category} placeholder="Entwicklung" /></label>
      </div>
      <div class="flex gap-2">
        <button class="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity" on:click={saveService}>Hinzufügen</button>
        <button class="px-4 py-2 rounded-lg border border-border text-secondary text-sm hover:bg-bg transition-colors" on:click={() => { addingService = false; serviceDraft = emptyDraft(); }}>Abbrechen</button>
      </div>
    </div>
  {:else}
    {#if services.length === 0}
      <div class="flex flex-col items-center justify-center py-16 text-center gap-3">
        <p class="text-sm font-medium text-primary">Noch keine Leistungen</p>
        <p class="text-[13px] text-muted max-w-xs">Lege Leistungsvorlagen an, um sie später in Rechnungen schnell auswählen zu können.</p>
        <button class="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity" on:click={() => { addingService = true; serviceDraft = emptyDraft(); }}>Erste Leistung anlegen</button>
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
