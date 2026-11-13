<!-- @module:billing -->
<script lang="ts">
  import { $services as servicesStore, addService, updateService, removeService } from '../../stores/serviceStore';
  import { formatEuro, isValidUnitPrice, isValidVatRate } from '../../lib/invoiceMoney';
  import type { ServiceItem } from '../../domain/types';
  import type { ServiceDraft } from '../../lib/serviceDraft';
  import ServiceRowForm from './ServiceRowForm.svelte';

  $: services = $servicesStore;

  let adding = false;
  let editingId: string | null = null;

  const emptyDraft = (): ServiceDraft => ({
    name: '', description: '', unit: 'Stunde', unitPrice: null, vatRate: 19, category: '',
  });

  let newDraft: ServiceDraft = emptyDraft();
  let editDraft: ServiceDraft = emptyDraft();

  function startEdit(s: ServiceItem) {
    adding = false;
    editingId = s.id;
    editDraft = {
      name: s.name,
      description: s.description,
      unit: s.unit,
      unitPrice: s.unitPrice,
      vatRate: s.vatRate,
      category: s.category ?? '',
    };
  }

  function startAdd() {
    editingId = null;
    newDraft = emptyDraft();
    adding = true;
  }

  function draftError(draft: ServiceDraft): string {
    if (draft.unitPrice != null && !isValidUnitPrice(draft.unitPrice)) return 'Der Einzelpreis darf nicht negativ sein.';
    if (draft.vatRate != null && !isValidVatRate(draft.vatRate)) return 'Die MwSt. muss zwischen 0 und 100 % liegen.';
    return '';
  }

  const fromDraft = (d: ServiceDraft) => ({
    name: d.name.trim(),
    description: d.description.trim(),
    unit: d.unit.trim() || 'Stunde',
    unitPrice: d.unitPrice ?? 0,
    vatRate: d.vatRate ?? 19,
    category: d.category.trim() || undefined,
  });

  function saveNew() {
    if (!newDraft.name.trim() || draftError(newDraft)) return;
    addService(fromDraft(newDraft));
    adding = false;
  }

  function saveEdit() {
    if (draftError(editDraft)) return;
    if (editingId && editDraft.name.trim()) updateService(editingId, fromDraft(editDraft));
    editingId = null;
  }

  function remove(s: ServiceItem) {
    if (confirm(`Leistung "${s.name}" löschen? Bereits erstellte Rechnungen bleiben unverändert.`)) {
      removeService(s.id);
      if (editingId === s.id) editingId = null;
    }
  }

  $: categories = [...new Set(services.map((s) => s.category).filter((c): c is string => !!c))];
  $: groups = (() => {
    const map = new Map<string, ServiceItem[]>();
    for (const s of services) {
      const key = s.category || 'Allgemein';
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()];
  })();
  const COLS = '1.4fr 2.6fr 0.8fr 0.9fr 0.6fr 96px';
</script>

<div class="flex-1 overflow-y-auto">
  <div class="flex flex-col gap-5 px-8 pt-5 pb-7">
    <header class="flex flex-wrap items-center gap-3">
      <div class="flex-[1_1_280px] flex flex-col gap-0.5">
        <h1 class="text-[24px] font-bold tracking-[-0.01em] leading-tight">Leistungen</h1>
        <span class="text-[13px]" style="color:var(--et-text-3)">Dein Katalog für Rechnungs- und Angebotspositionen · {services.length} {services.length === 1 ? 'Eintrag' : 'Einträge'}</span>
      </div>
      <button class="et-btn et-btn-primary" aria-expanded={adding} on:click={startAdd}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>
        Neue Leistung
      </button>
    </header>

    <div class="overflow-x-auto et-card">
      <div class="min-w-[860px] flex flex-col">
        <div class="et-th grid items-center gap-4 px-5 py-2.5" style="grid-template-columns:{COLS}">
          <span>Bezeichnung</span><span>Rechnungstext</span><span>Einheit</span><span class="text-right">Preis netto</span><span class="text-right">MwSt.</span><span></span>
        </div>

        {#if adding}
          <ServiceRowForm bind:draft={newDraft} idPrefix="svc-new" {categories} error={draftError(newDraft)} saveLabel="Hinzufügen" onSave={saveNew} onCancel={() => (adding = false)} />
        {/if}

        {#each groups as [category, items] (category)}
          <div class="et-row px-5 py-2 text-[12px] font-semibold" style="background:var(--et-surface-sunken);color:var(--et-text-2)">{category}</div>
          {#each items as s (s.id)}
            {#if editingId === s.id}
              <ServiceRowForm bind:draft={editDraft} idPrefix="svc-{s.id}" {categories} error={draftError(editDraft)} onSave={saveEdit} onCancel={() => (editingId = null)} />
            {:else}
              <div class="et-row grid items-center gap-4 min-h-[60px] pl-5 pr-3" style="grid-template-columns:{COLS}">
                <span class="font-semibold">{s.name}</span>
                <span class="text-[13px]" style="color:var(--et-text-2)">{s.description || '–'}</span>
                <span>{s.unit}</span>
                <span class="text-right tabular-nums">{formatEuro(Math.round(s.unitPrice * 100))}</span>
                <span class="text-right tabular-nums">{s.vatRate} %</span>
                <span class="flex gap-1">
                  <button class="et-btn et-btn-ghost et-btn-icon et-btn-md" style="width:40px;padding:0" aria-label="{s.name} bearbeiten" on:click={() => startEdit(s)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"></path><path d="M13.5 6.5l4 4"></path></svg>
                  </button>
                  <button class="et-btn et-btn-ghost et-btn-icon et-btn-md" style="width:40px;padding:0" aria-label="{s.name} löschen" on:click={() => remove(s)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"></path><path d="M9 7V4h6v3"></path><path d="M6 7l1 13h10l1-13"></path></svg>
                  </button>
                </span>
              </div>
            {/if}
          {/each}
        {/each}

        {#if services.length === 0 && !adding}
          <div class="et-row flex flex-col items-start gap-3 px-5 py-8">
            <p class="text-[13px]" style="color:var(--et-text-3)">Noch keine Leistungen. Lege Vorlagen an, um sie später in Rechnungen schnell auszuwählen.</p>
            <button class="et-btn et-btn-primary" on:click={startAdd}>Erste Leistung anlegen</button>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
