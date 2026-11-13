<!-- @module:projects -->
<script lang="ts">
  import {
    $billingItems as billingItemsStore,
    $billingItemTasks as billingItemTasksStore,
    $unlockedBillingItemIds as unlockedBillingItemIdsStore,
    addBillingItem,
    updateBillingItem,
    removeBillingItem,
    linkTaskToBillingItem,
    unlinkTaskFromBillingItem,
  } from '../../stores/billingStore';
  import { $tasks as tasksStore } from '../../stores/taskStore';
  import { toast } from '../../stores/toastStore';
  import { isValidQuantity, isValidUnitPrice } from '../../lib/invoiceMoney';
  import type { BillingItem, BillingType, Project } from '../../domain/types';

  export let project: Project;

  $: items = $billingItemsStore
    .filter((i) => i.projectId === project.id)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  $: links = $billingItemTasksStore;
  $: unlockedIds = $unlockedBillingItemIdsStore;
  $: projectTasks = $tasksStore.filter((t) => t.projectId === project.id && !t.recurrence);

  const TYPE_LABELS: Record<BillingType, string> = { hourly: 'Stundenbasiert', fixed: 'Festpreis', unit: 'Einheit' };

  const euro = (cents: number) =>
    (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  interface Draft { title: string; billingType: BillingType; unitPriceEuro: string; quantity: string }
  const emptyDraft = (): Draft => ({ title: '', billingType: 'hourly', unitPriceEuro: '', quantity: '' });

  let form = false;
  let editingId: string | null = null;
  let draft: Draft = emptyDraft();
  let expandedId: string | null = null;

  function openForm(item?: BillingItem) {
    editingId = item?.id ?? null;
    draft = item
      ? {
          title: item.title,
          billingType: item.billingType,
          unitPriceEuro: item.unitPriceCents != null ? String(item.unitPriceCents / 100) : '',
          quantity: item.quantity != null ? String(item.quantity) : '',
        }
      : emptyDraft();
    form = true;
  }

  function closeForm() {
    form = false;
    editingId = null;
    draft = emptyDraft();
  }

  function save() {
    if (!draft.title.trim()) return;
    const unitPrice = draft.unitPriceEuro ? parseFloat(draft.unitPriceEuro) : null;
    if (unitPrice != null && !isNaN(unitPrice) && !isValidUnitPrice(unitPrice)) {
      toast('Der Einzelpreis darf nicht negativ sein.', 'error', 3500);
      return;
    }
    const quantity = draft.billingType === 'unit' && draft.quantity ? parseFloat(draft.quantity) : null;
    if (quantity != null && !isValidQuantity(quantity)) {
      toast('Die Menge muss größer als 0 sein.', 'error', 3500);
      return;
    }
    const cents = unitPrice != null ? Math.round(unitPrice * 100) : null;
    const data = {
      title: draft.title.trim(),
      billingType: draft.billingType,
      unitPriceCents: isNaN(cents ?? NaN) ? null : cents,
      quantity,
    };
    if (editingId) updateBillingItem(editingId, data);
    else addBillingItem(project.id, data);
    closeForm();
  }

  const isLinked = (itemId: string, taskId: string) => links.some((l) => l.billingItemId === itemId && l.taskId === taskId);

  function toggleLink(itemId: string, taskId: string) {
    if (isLinked(itemId, taskId)) unlinkTaskFromBillingItem(itemId, taskId);
    else linkTaskToBillingItem(itemId, taskId);
  }

  function remove(item: BillingItem) {
    removeBillingItem(item.id);
    if (expandedId === item.id) expandedId = null;
  }
</script>

<section class="et-card flex flex-col" aria-label="Rechnungspositionen">
  <div class="flex flex-wrap items-center gap-3 px-5 py-3.5">
    <div class="flex-1 min-w-[220px]">
      <h2 class="et-h2">Rechnungspositionen</h2>
      <span class="text-[12px]" style="color:var(--et-text-3)">Eine Position ist eine Abrechnungseinheit. Verknüpfte Aufgaben zeigen, wann sie abrechenbar ist.</span>
    </div>
    {#if !form}
      <button class="et-btn et-btn-accent" on:click={() => openForm()}>+ Position</button>
    {/if}
  </div>

  {#if form}
    <form class="et-row flex flex-wrap items-end gap-3 px-5 py-3" style="background:var(--et-accent-soft)" aria-label={editingId ? 'Position bearbeiten' : 'Neue Position'} on:submit|preventDefault={save}>
      <div class="flex-[2_1_220px] flex flex-col gap-1">
        <label class="et-label" for="bi-title">Bezeichnung</label>
        <!-- svelte-ignore a11y-autofocus -->
        <input id="bi-title" class="et-field" bind:value={draft.title} autofocus />
      </div>
      <div class="flex-[1_1_160px] flex flex-col gap-1">
        <label class="et-label" for="bi-type">Abrechnung</label>
        <select id="bi-type" class="et-field" bind:value={draft.billingType}>
          {#each Object.entries(TYPE_LABELS) as [id, label] (id)}<option value={id}>{label}</option>{/each}
        </select>
      </div>
      <div class="flex-[1_1_120px] flex flex-col gap-1">
        <label class="et-label" for="bi-price">Preis in €</label>
        <input id="bi-price" class="et-field" type="number" step="0.01" min="0" bind:value={draft.unitPriceEuro} />
      </div>
      {#if draft.billingType === 'unit'}
        <div class="flex-[1_1_100px] flex flex-col gap-1">
          <label class="et-label" for="bi-qty">Menge</label>
          <input id="bi-qty" class="et-field" type="number" step="any" min="0" bind:value={draft.quantity} />
        </div>
      {/if}
      <div class="flex gap-2">
        <button type="submit" class="et-btn et-btn-primary" disabled={!draft.title.trim()}>{editingId ? 'Speichern' : 'Hinzufügen'}</button>
        <button type="button" class="et-btn" on:click={closeForm}>Abbrechen</button>
      </div>
    </form>
  {/if}

  {#if items.length === 0 && !form}
    <div class="et-row px-5 py-6 text-[13px]" style="color:var(--et-text-3)">Keine Rechnungspositionen für dieses Projekt.</div>
  {/if}

  {#each items as item (item.id)}
    {@const unlocked = unlockedIds.includes(item.id)}
    {@const linkedIds = links.filter((l) => l.billingItemId === item.id).map((l) => l.taskId)}
    {@const linkedDone = linkedIds.filter((id) => $tasksStore.find((t) => t.id === id)?.status === 'done').length}
    {@const open = expandedId === item.id}
    <div class="et-row">
      <button
        class="w-full flex flex-wrap items-center gap-x-4 gap-y-1 min-h-[56px] px-5 py-2 text-left transition-colors hover:bg-[var(--et-surface-sunken)]"
        aria-expanded={open}
        aria-controls="bi-{item.id}"
        on:click={() => (expandedId = open ? null : item.id)}
      >
        <span class="flex-[1_1_200px] font-semibold min-w-0 truncate">{item.title}</span>
        <span class="et-badge">{TYPE_LABELS[item.billingType]}</span>
        <span class="text-[13px] tabular-nums min-w-[110px] text-right">
          {#if item.unitPriceCents != null}{#if item.billingType === 'unit' && item.quantity != null}{item.quantity.toLocaleString('de-DE')} × {/if}{euro(item.unitPriceCents)}{:else}<span style="color:var(--et-text-3)">kein Preis</span>{/if}
        </span>
        {#if unlocked}
          <span class="et-badge et-badge-green">Abrechenbar</span>
        {:else if linkedIds.length > 0}
          <span class="text-[12px]" style="color:var(--et-text-3)">{linkedDone} von {linkedIds.length} Aufgaben erledigt</span>
        {:else}
          <span class="text-[12px]" style="color:var(--et-text-3)">keine Aufgaben verknüpft</span>
        {/if}
        <svg class="flex-shrink-0 transition-transform {open ? 'rotate-180' : ''}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--et-text-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>
      </button>

      {#if open}
        <div id="bi-{item.id}" class="flex flex-col gap-2 px-5 pb-4 pt-1" style="background:var(--et-surface-sunken)">
          <span class="et-label">Verknüpfte Aufgaben</span>
          {#if projectTasks.length === 0}
            <p class="text-[13px]" style="color:var(--et-text-3)">Keine Aufgaben in diesem Projekt.</p>
          {:else}
            <div class="flex flex-col max-h-64 overflow-y-auto">
              {#each projectTasks as task (task.id)}
                <label class="flex items-center gap-3 min-h-10 px-2 rounded-lg cursor-pointer hover:bg-[var(--et-track)]">
                  <input type="checkbox" class="w-4 h-4" style="accent-color:var(--et-accent)" checked={isLinked(item.id, task.id)} on:change={() => toggleLink(item.id, task.id)} />
                  <span class="flex-1 truncate">{task.title}</span>
                  <span class="text-[12px] font-semibold" style="color:{task.status === 'done' ? 'var(--et-success-text)' : 'var(--et-text-3)'}">{task.status === 'done' ? 'erledigt' : 'offen'}</span>
                </label>
              {/each}
            </div>
          {/if}
          <div class="flex justify-end gap-2 pt-1">
            <button class="et-btn et-btn-sm" on:click={() => openForm(item)}>Bearbeiten</button>
            <button class="et-btn et-btn-sm et-btn-danger" on:click={() => remove(item)}>Löschen</button>
          </div>
        </div>
      {/if}
    </div>
  {/each}
</section>
