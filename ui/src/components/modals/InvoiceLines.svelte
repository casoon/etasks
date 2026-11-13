<!-- @module:billing -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import type {
    BillingItem,
    Client,
    Invoice,
    InvoiceLineItem,
    ServiceItem,
    Task,
    TimeEntry,
    Termin,
  } from '../../domain/types';
  import { formatTrackedTime, today } from '../../domain/dateUtils';
  import {
    formatCents,
    formatEuro,
    isValidQuantity,
    isValidUnitPrice,
    isValidVatRate,
    lineTotalCents,
  } from '../../lib/invoiceMoney';
  import {
    billableTermineForClient,
    billingItemToLineItem,
    minutesToQuarterHours,
    termineToLineItem,
    trackedTimeByProject,
    trackedTimeToLineItem,
  } from '../../lib/invoiceImport';
  import { toast } from '../../stores/toastStore';
  import { $pendingImportRange as pendingRangeStore } from '../../stores/invoiceStore';

  export let invoice: Invoice;
  export let client: Client | undefined = undefined;
  export let services: ServiceItem[] = [];
  export let tasks: Task[] = [];
  export let projects: Array<{ id: string; name: string; clientId: string }> = [];
  export let defaultVatRate = 19;
  export let profileHourlyRate: number | undefined = undefined;
  export let billingItems: readonly BillingItem[] = [];
  export let unlockedBillingItemIds: readonly string[] = [];
  export let timeEntries: readonly TimeEntry[] = [];
  export let termine: readonly Termin[] = [];
  export let blockedTaskIds: Set<string> = new Set();
  export let onUpdate: (patch: Partial<Omit<Invoice, 'id' | 'createdAt'>>) => void;

  type Panel = 'time' | 'project' | 'catalog' | 'free' | null;
  let panel: Panel = null;
  let taskPickerForLineItem: string | null = null;
  let timeFrom = today().slice(0, 8) + '01';
  let timeTo = today();
  let catalogQuery = '';
  let freeName = '';

  // A period handed over from Berichte opens the time import for exactly that range.
  const handedOver = pendingRangeStore.get();
  if (handedOver) {
    timeFrom = handedOver.from;
    timeTo = handedOver.to;
    panel = invoice.clientId ? 'time' : null;
    pendingRangeStore.set(null);
  }

  // Pending text edits; flushed on focus leaving the table (before another invoice is selected) and on destroy.
  const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; run: () => void }>();
  export function flush() {
    for (const { timer, run } of [...pending.values()]) {
      clearTimeout(timer);
      run();
    }
  }
  onDestroy(flush);

  $: clientId = invoice.clientId;
  $: hourlyRate = client?.hourlyRate ?? profileHourlyRate;
  $: hourlyRateSource = client?.hourlyRate != null ? 'Kunde' : 'Profil';
  $: availableClientTasks = clientId
    ? tasks.filter((t) => projects.find((p) => p.id === t.projectId)?.clientId === clientId && !blockedTaskIds.has(t.id))
    : [];
  $: clientBillingItems = clientId
    ? billingItems
        .filter((i) => projects.find((p) => p.id === i.projectId)?.clientId === clientId)
        .map((i) => ({ item: i, ready: unlockedBillingItemIds.includes(i.id) }))
        .sort((a, b) => Number(b.ready) - Number(a.ready))
    : [];
  $: trackedRows = clientId
    ? trackedTimeByProject(
        timeEntries,
        (taskId) => tasks.find((t) => t.id === taskId)?.projectId,
        projects,
        clientId,
        timeFrom,
        timeTo,
      )
    : [];
  $: terminSummary = clientId
    ? billableTermineForClient(termine, projects, clientId, timeFrom, timeTo)
    : { count: 0, minutes: 0 };
  $: catalogMatches = catalogQuery.trim()
    ? services.filter((s) => s.name.toLowerCase().includes(catalogQuery.trim().toLowerCase()))
    : services;

  function togglePanel(next: Exclude<Panel, null>) {
    panel = panel === next ? null : next;
  }

  function patchLineItem(lineItemId: string, patch: Partial<InvoiceLineItem>) {
    onUpdate({ lineItems: invoice.lineItems.map((li) => (li.id === lineItemId ? { ...li, ...patch } : li)) });
  }

  function onStr(lineItemId: string, field: 'name' | 'description' | 'unit') {
    return (e: Event) => {
      const val = (e.currentTarget as HTMLInputElement).value;
      const key = `${lineItemId}:${field}`;
      clearTimeout(pending.get(key)?.timer);
      const run = () => {
        pending.delete(key);
        patchLineItem(lineItemId, { [field]: val } as Partial<InvoiceLineItem>);
      };
      pending.set(key, { timer: setTimeout(run, 400), run });
    };
  }

  const numRules = {
    unitPrice: { valid: isValidUnitPrice, message: 'Der Einzelpreis darf nicht negativ sein.' },
    quantity: { valid: isValidQuantity, message: 'Die Menge muss größer als 0 sein.' },
    vatRate: { valid: isValidVatRate, message: 'Die MwSt. muss zwischen 0 und 100 % liegen.' },
  } as const;

  function onNum(lineItemId: string, field: keyof typeof numRules) {
    return (e: Event) => {
      const input = e.currentTarget as HTMLInputElement;
      const value = parseFloat(input.value);
      const rule = numRules[field];
      if (!rule.valid(value)) {
        input.value = String(invoice.lineItems.find((li) => li.id === lineItemId)?.[field] ?? '');
        toast(rule.message, 'error', 3500);
        return;
      }
      patchLineItem(lineItemId, { [field]: value });
    };
  }

  function add(item: InvoiceLineItem) {
    onUpdate({ lineItems: [...invoice.lineItems, item] });
  }

  function addFree() {
    const name = freeName.trim();
    if (!name) return;
    add({
      id: crypto.randomUUID(),
      name,
      description: '',
      unit: 'Stunde',
      unitPrice: 0,
      quantity: 1,
      vatRate: defaultVatRate,
      taskIds: [],
    });
    freeName = '';
    panel = null;
  }

  function addCatalog(svc: ServiceItem) {
    add({
      id: crypto.randomUUID(),
      serviceItemId: svc.id,
      name: svc.name,
      description: svc.description,
      unit: svc.unit,
      unitPrice: svc.unitPrice,
      quantity: 1,
      vatRate: svc.vatRate,
      taskIds: [],
    });
    catalogQuery = '';
    panel = null;
  }

  const hours = (h: number) => h.toLocaleString('de-DE', { maximumFractionDigits: 2 });

  function removeLine(lineItemId: string) {
    onUpdate({ lineItems: invoice.lineItems.filter((li) => li.id !== lineItemId) });
    if (taskPickerForLineItem === lineItemId) taskPickerForLineItem = null;
  }

  function assignTask(taskId: string, lineItemId: string) {
    onUpdate({
      lineItems: invoice.lineItems.map((li) =>
        li.id === lineItemId
          ? { ...li, taskIds: [...li.taskIds.filter((id) => id !== taskId), taskId] }
          : { ...li, taskIds: li.taskIds.filter((id) => id !== taskId) },
      ),
    });
    taskPickerForLineItem = null;
  }

  function removeTask(taskId: string, lineItemId: string) {
    const li = invoice.lineItems.find((l) => l.id === lineItemId);
    if (li) patchLineItem(lineItemId, { taskIds: li.taskIds.filter((id) => id !== taskId) });
  }

  const taskById = (id: string) => tasks.find((t) => t.id === id);
  const projectName = (id?: string) => (id ? (projects.find((p) => p.id === id)?.name ?? '') : '');
  const COLS = '2.6fr 0.8fr 0.9fr 1fr 0.7fr 1fr 40px';
</script>

<section aria-label="Positionen" class="et-card flex flex-col" on:focusout={flush}>
  <div class="flex flex-wrap items-center gap-2 px-5 py-3.5">
    <h2 class="et-h2 flex-[1_1_140px]">Positionen</h2>
    <button class="et-btn et-btn-accent et-btn-md" aria-expanded={panel === 'time'} disabled={!clientId} on:click={() => togglePanel('time')}>Erfasste Zeit übernehmen</button>
    <button class="et-btn et-btn-accent et-btn-md" aria-expanded={panel === 'project'} disabled={!clientId} on:click={() => togglePanel('project')}>Aus Projekt übernehmen</button>
    <button class="et-btn et-btn-md" aria-expanded={panel === 'catalog'} on:click={() => togglePanel('catalog')}>Aus Leistungskatalog</button>
  </div>
  {#if !clientId}
    <p class="px-5 pb-3 text-[12px]" style="color:var(--et-text-3)">Erfasste Zeit und Projekt-Positionen lassen sich übernehmen, sobald ein Kunde gewählt ist.</p>
  {/if}

  {#if panel === 'project'}
    <div class="flex flex-col border-t" style="border-color:var(--et-border-subtle);background:var(--et-surface-sunken)">
      {#if clientBillingItems.length === 0}
        <p class="px-5 py-3 text-[13px]" style="color:var(--et-text-3)">Keine Projekt-Positionen für diesen Kunden.</p>
      {/if}
      {#each clientBillingItems as { item, ready } (item.id)}
        <button class="et-row flex items-center gap-3 min-h-11 px-5 text-left" on:click={() => add(billingItemToLineItem(item, defaultVatRate))}>
          <span class="flex-1 font-medium">{item.title}</span>
          {#if ready}<span class="et-badge et-badge-green">Abrechenbar</span>{/if}
          <span class="text-[13px]" style="color:var(--et-text-3)">{projectName(item.projectId)}</span>
          <span class="text-[13px] tabular-nums">{formatEuro(item.unitPriceCents ?? 0)}</span>
        </button>
      {/each}
      <button class="et-row min-h-11 px-5 text-[13px] font-semibold text-left" style="color:var(--et-accent)" on:click={() => (panel = null)}>Schließen</button>
    </div>
  {:else if panel === 'time'}
    <div class="flex flex-col border-t" style="border-color:var(--et-border-subtle);background:var(--et-surface-sunken)">
      <div class="flex flex-wrap items-end gap-3 px-5 py-3">
        <div class="flex flex-col gap-1 w-[150px]">
          <label class="et-label" for="inv-time-from">Von</label>
          <input id="inv-time-from" class="et-field" type="date" lang="de" bind:value={timeFrom} />
        </div>
        <div class="flex flex-col gap-1 w-[150px]">
          <label class="et-label" for="inv-time-to">Bis</label>
          <input id="inv-time-to" class="et-field" type="date" lang="de" bind:value={timeTo} />
        </div>
        <p class="flex-1 min-w-[200px] text-[12px]" style="color:var(--et-text-3)">
          {#if hourlyRate != null}
            Stundensatz {formatEuro(Math.round(hourlyRate * 100))} ({hourlyRateSource}). Zeit wird auf Viertelstunden gerundet.
          {:else}
            Kein Stundensatz hinterlegt (weder beim Kunden noch im Profil); der Preis wird mit 0 € eingetragen.
          {/if}
        </p>
      </div>
      {#if trackedRows.length === 0 && terminSummary.count === 0}
        <p class="et-row px-5 py-3 text-[13px]" style="color:var(--et-text-3)">Keine erfasste Zeit für diesen Kunden im Zeitraum.</p>
      {/if}
      {#each trackedRows as row (row.projectId)}
        <button
          class="et-row flex items-center gap-3 min-h-11 px-5 text-left"
          title={row.tasks.map((t) => `${taskById(t.taskId)?.title ?? 'Aufgabe'}: ${formatTrackedTime(t.minutes * 60)}`).join('\n')}
          on:click={() => add(trackedTimeToLineItem(row, hourlyRate ?? 0, defaultVatRate, timeFrom, timeTo))}
        >
          <span class="flex-1 font-medium">{row.projectName}</span>
          <span class="text-[13px] tabular-nums" style="color:var(--et-text-3)">{formatTrackedTime(row.minutes * 60)} erfasst</span>
          <span class="text-[13px] font-semibold tabular-nums">{hours(minutesToQuarterHours(row.minutes))} h</span>
        </button>
      {/each}
      {#if terminSummary.count > 0}
        <button class="et-row flex items-center gap-3 min-h-11 px-5 text-left" on:click={() => add(termineToLineItem(terminSummary, hourlyRate ?? 0, defaultVatRate, timeFrom, timeTo))}>
          <span class="flex-1 font-medium">Abrechenbare Termine ({terminSummary.count})</span>
          <span class="text-[13px] tabular-nums" style="color:var(--et-text-3)">{formatTrackedTime(terminSummary.minutes * 60)}</span>
          <span class="text-[13px] font-semibold tabular-nums">{hours(minutesToQuarterHours(terminSummary.minutes))} h</span>
        </button>
      {/if}
      <button class="et-row min-h-11 px-5 text-[13px] font-semibold text-left" style="color:var(--et-accent)" on:click={() => (panel = null)}>Schließen</button>
    </div>
  {:else if panel === 'catalog'}
    <div class="flex flex-col border-t" style="border-color:var(--et-border-subtle);background:var(--et-surface-sunken)">
      <div class="flex flex-col gap-1 px-5 py-3">
        <label class="et-label" for="inv-catalog-search">Leistung suchen</label>
        <input id="inv-catalog-search" class="et-field max-w-[320px]" type="search" bind:value={catalogQuery} placeholder="Bezeichnung" />
      </div>
      {#if services.length === 0}
        <p class="et-row px-5 py-3 text-[13px]" style="color:var(--et-text-3)">Der Leistungskatalog ist noch leer.</p>
      {:else if catalogMatches.length === 0}
        <p class="et-row px-5 py-3 text-[13px]" style="color:var(--et-text-3)">Keine Leistung passt zur Suche.</p>
      {/if}
      {#each catalogMatches as svc (svc.id)}
        <button class="et-row flex items-center gap-3 min-h-11 px-5 py-1.5 text-left" on:click={() => addCatalog(svc)}>
          <span class="flex-1 min-w-0 flex flex-col">
            <span class="font-medium">{svc.name}</span>
            {#if svc.description}<span class="text-[12px] truncate" style="color:var(--et-text-3)">{svc.description}</span>{/if}
          </span>
          <span class="text-[13px] tabular-nums">{formatEuro(Math.round(svc.unitPrice * 100))} / {svc.unit}</span>
        </button>
      {/each}
      <button class="et-row min-h-11 px-5 text-[13px] font-semibold text-left" style="color:var(--et-accent)" on:click={() => (panel = null)}>Schließen</button>
    </div>
  {/if}

  <div class="overflow-x-auto">
    <div class="min-w-[760px] flex flex-col">
      <div class="et-th grid items-center gap-3 px-5 py-2 border-t" style="grid-template-columns:{COLS};border-color:var(--et-border-subtle)">
        <span>Bezeichnung</span><span class="text-right">Menge</span><span>Einheit</span><span class="text-right">Einzelpreis</span><span class="text-right">MwSt.</span><span class="text-right">Gesamt netto</span><span></span>
      </div>
      {#each invoice.lineItems as li, index (li.id)}
        <div class="et-row flex flex-col gap-2 px-5 py-3">
          <div class="grid items-start gap-3" style="grid-template-columns:{COLS}">
            <div class="flex flex-col gap-1.5 min-w-0">
              {#if li.serviceItemId}
                <span class="flex items-center gap-2 min-h-10">
                  <span class="font-semibold truncate">{li.name}</span>
                  <span class="et-badge">Katalog</span>
                </span>
              {:else}
                <input class="et-field et-field-cell font-semibold" aria-label="Bezeichnung Position {index + 1}" value={li.name} placeholder="Bezeichnung" on:input={onStr(li.id, 'name')} />
              {/if}
              <input class="et-field et-field-cell text-[13px]" aria-label="Rechnungstext Position {index + 1}" value={li.description} placeholder="Rechnungstext (optional)" on:input={onStr(li.id, 'description')} />
            </div>
            <input class="et-field et-field-cell text-right tabular-nums" aria-label="Menge Position {index + 1}" type="number" step="any" min="0" value={li.quantity} on:change={onNum(li.id, 'quantity')} />
            <input class="et-field et-field-cell" aria-label="Einheit Position {index + 1}" value={li.unit} placeholder="Stunde" on:input={onStr(li.id, 'unit')} />
            <input class="et-field et-field-cell text-right tabular-nums" aria-label="Einzelpreis in Euro Position {index + 1}" type="number" step="0.01" min="0" value={li.unitPrice} on:change={onNum(li.id, 'unitPrice')} />
            <input class="et-field et-field-cell text-right tabular-nums" aria-label="MwSt. in Prozent Position {index + 1}" type="number" min="0" max="100" value={li.vatRate} on:change={onNum(li.id, 'vatRate')} />
            <span class="min-h-10 flex items-center justify-end font-semibold tabular-nums">{formatCents(lineTotalCents(li.unitPrice, li.quantity)).replace('.', ',')} €</span>
            <button class="et-btn et-btn-ghost et-btn-sm et-btn-icon" aria-label="Position {index + 1} entfernen" on:click={() => removeLine(li.id)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>
            </button>
          </div>
          {#if clientId || li.taskIds.length > 0}
            <div class="flex flex-wrap items-center gap-2 text-[12px]">
              <span class="et-label">Aufgaben</span>
              {#each li.taskIds as taskId (taskId)}
                {@const t = taskById(taskId)}
                {#if t}
                  <span class="et-badge">
                    {t.title}
                    <button class="inline-flex items-center justify-center w-6 h-6 -mr-1 rounded" aria-label="Aufgabe {t.title} von Position {index + 1} lösen" on:click={() => removeTask(taskId, li.id)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>
                    </button>
                  </span>
                {/if}
              {/each}
              {#if clientId}
                <button class="et-chip" aria-expanded={taskPickerForLineItem === li.id} on:click={() => (taskPickerForLineItem = taskPickerForLineItem === li.id ? null : li.id)}>+ Aufgabe</button>
              {/if}
            </div>
          {/if}
          {#if taskPickerForLineItem === li.id}
            <div class="flex flex-col rounded-[10px] border overflow-hidden" style="border-color:var(--et-border);background:var(--et-surface-sunken)">
              {#if availableClientTasks.length === 0}
                <p class="px-4 py-3 text-[13px]" style="color:var(--et-text-3)">Keine verfügbaren Aufgaben für diesen Kunden.</p>
              {:else}
                {#each availableClientTasks as t (t.id)}
                  <button class="et-row flex items-center gap-3 min-h-11 px-4 text-left" on:click={() => assignTask(t.id, li.id)}>
                    <span class="flex-1 font-medium">{t.title}</span>
                    <span class="text-[13px]" style="color:var(--et-text-3)">{projectName(t.projectId)}</span>
                    <span class="text-[13px] tabular-nums" style="color:var(--et-text-3)">{t.trackedSeconds ? formatTrackedTime(t.trackedSeconds) : '–'}</span>
                  </button>
                {/each}
              {/if}
              <button class="et-row min-h-11 px-4 text-[13px] font-semibold text-left" style="color:var(--et-accent)" on:click={() => (taskPickerForLineItem = null)}>Schließen</button>
            </div>
          {/if}
        </div>
      {/each}
      {#if invoice.lineItems.length === 0}
        <p class="et-row px-5 py-6 text-[13px]" style="color:var(--et-text-3)">Noch keine Positionen. Übernimm erfasste Zeit oder Projekt-Positionen, wähle eine Leistung aus dem Katalog oder lege eine freie Position an.</p>
      {/if}
    </div>
  </div>

  <div class="px-5 pt-2.5 pb-3.5 border-t" style="border-color:var(--et-border-subtle)">
    {#if panel === 'free'}
      <form class="flex flex-wrap items-end gap-3" on:submit|preventDefault={addFree}>
        <div class="flex-[1_1_260px] flex flex-col gap-1">
          <label class="et-label" for="inv-free-name">Bezeichnung der Position</label>
          <!-- svelte-ignore a11y-autofocus -->
          <input id="inv-free-name" class="et-field" bind:value={freeName} autofocus on:keydown={(e) => e.key === 'Escape' && (panel = null)} />
        </div>
        <button type="submit" class="et-btn et-btn-primary" disabled={!freeName.trim()}>Hinzufügen</button>
        <button type="button" class="et-btn" on:click={() => (panel = null)}>Abbrechen</button>
      </form>
    {:else}
      <button id="inv-add-free" class="et-btn" style="border-style:dashed;border-color:var(--et-border-control);background:transparent;font-weight:500" on:click={() => (panel = 'free')}>+ Freie Position</button>
    {/if}
  </div>
</section>
