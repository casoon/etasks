<!-- @module:billing -->
<script lang="ts">
  import type { Client, Invoice } from '../../domain/types';
  import { formatDateDe, today } from '../../domain/dateUtils';
  import { formatEuro } from '../../lib/invoiceMoney';
  import {
    displayStatus,
    dueLabel,
    filterInvoices,
    invoiceGrossCents,
    matchesFilter,
    openSummary,
    type InvoiceFilter,
  } from '../../lib/invoiceStatus';
  import { $navItem as navItemStore } from '../../stores/uiStore';
  import InvoiceStatusBadge from './InvoiceStatusBadge.svelte';

  export let invoices: Invoice[] = [];
  export let clients: Client[] = [];
  export let creating = false;
  export let onCreate: () => void;
  export let onSelect: (invoiceId: string) => void;

  const FILTERS: { id: InvoiceFilter; label: string }[] = [
    { id: 'open', label: 'Offen' },
    { id: 'draft', label: 'Entwürfe' },
    { id: 'sent', label: 'Gesendet' },
    { id: 'paid', label: 'Bezahlt' },
    { id: 'all', label: 'Alle' },
  ];

  let filter: InvoiceFilter = 'open';
  let query = '';

  $: todayKey = today();
  $: clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? '';
  $: rows = filterInvoices(invoices, clientName, filter, query);
  $: counts = Object.fromEntries(
    FILTERS.map((f) => [f.id, invoices.filter((i) => matchesFilter(i, f.id)).length]),
  ) as Record<InvoiceFilter, number>;
  $: summary = openSummary(invoices, todayKey);
  $: context =
    `${formatEuro(summary.openCents)} offen` +
    (summary.overdueCount > 0 ? ` · ${summary.overdueCount} überfällig` : '');
</script>

<div class="flex-1 overflow-y-auto">
  <div class="flex flex-col gap-5 px-8 pt-5 pb-7">
    <header class="flex flex-wrap items-center gap-3">
      <div class="flex-[1_1_280px] flex flex-col gap-0.5">
        <h1 class="text-[24px] font-bold tracking-[-0.01em] leading-tight">Rechnungen</h1>
        <span class="text-[13px]" style="color:var(--et-text-3)">{context}</span>
      </div>
      <button class="et-btn et-btn-primary" disabled={creating} on:click={onCreate}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>
        Neue Rechnung
      </button>
    </header>

    <div class="flex flex-wrap items-center gap-3">
      <div class="et-seg" role="group" aria-label="Status filtern">
        {#each FILTERS as f (f.id)}
          <button aria-pressed={filter === f.id} on:click={() => (filter = f.id)}>{f.label}{f.id === 'all' ? '' : ` · ${counts[f.id]}`}</button>
        {/each}
      </div>
      <span class="flex-1"></span>
      <label class="flex items-center gap-2 h-11 w-[260px] max-w-full px-3 rounded-[10px] border bg-surface focus-within:outline-2 focus-within:outline-offset-2" style="border-color:var(--et-border-strong);outline-color:var(--et-accent)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--et-text-3)" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6"></circle><path d="M16 16l4 4"></path></svg>
        <input type="search" class="flex-1 min-w-0 bg-transparent border-none outline-none" aria-label="Nummer oder Kunde suchen" placeholder="Nummer oder Kunde suchen" bind:value={query} />
      </label>
    </div>

    <div class="overflow-x-auto et-card">
      <div class="min-w-[860px] flex flex-col">
        <div class="et-th grid items-center gap-4 px-5 py-2.5" style="grid-template-columns:1.2fr 1.8fr 1fr 1.5fr 1.1fr 1fr 28px">
          <span>Nummer</span><span>Kunde</span><span>Datum</span><span>Fällig</span><span>Status</span><span class="text-right">Betrag brutto</span><span></span>
        </div>
        {#each rows as inv (inv.id)}
          {@const due = dueLabel(inv, todayKey)}
          <button
            class="et-row grid items-center gap-4 min-h-[60px] px-5 w-full text-left"
            style="grid-template-columns:1.2fr 1.8fr 1fr 1.5fr 1.1fr 1fr 28px"
            on:click={() => onSelect(inv.id)}
          >
            <span class="font-semibold truncate">{inv.invoiceNumber || 'Ohne Nummer'}</span>
            <span class="truncate" style="color:{inv.clientId ? 'inherit' : 'var(--et-text-3)'}">{inv.clientId ? clientName(inv.clientId) || '–' : 'Ohne Kunde'}</span>
            <span class="tabular-nums">{formatDateDe(inv.date)}</span>
            <span class="tabular-nums" style="color:{due.state === 'overdue' ? 'var(--et-danger)' : 'var(--et-text-3)'};font-weight:{due.state === 'overdue' ? 600 : 400}">{due.text}</span>
            <span><InvoiceStatusBadge status={displayStatus(inv, todayKey)} /></span>
            <span class="text-right font-semibold tabular-nums">{formatEuro(invoiceGrossCents(inv))}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--et-text-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>
          </button>
        {/each}

        {#if rows.length === 0}
          <div class="et-row flex flex-col items-start gap-3 px-5 py-8">
            <p class="text-[13px]" style="color:var(--et-text-3)">
              {invoices.length === 0
                ? 'Noch keine Rechnungen. Erstelle Rechnungen aus Kunden, Leistungen und erfasster Zeit.'
                : query.trim()
                  ? 'Keine Rechnung passt zur Suche.'
                  : filter === 'all'
                    ? 'Noch keine Rechnungen.'
                    : `Keine Rechnungen mit dem Filter „${FILTERS.find((f) => f.id === filter)?.label}“.`}
            </p>
            {#if invoices.length === 0}
              <button class="et-btn et-btn-primary" disabled={creating} on:click={onCreate}>Erste Rechnung erstellen</button>
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <div class="flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
      <button class="font-semibold min-h-11 px-1" style="color:var(--et-accent)" on:click={() => navItemStore.set('clients')}>Kunden und Stundensätze →</button>
      <button class="font-semibold min-h-11 px-1" style="color:var(--et-accent)" on:click={() => navItemStore.set('services')}>Leistungskatalog →</button>
      <button class="font-semibold min-h-11 px-1" style="color:var(--et-accent)" on:click={() => navItemStore.set('settings')}>Nummernkreis und Rechnungsdaten →</button>
    </div>
  </div>
</div>
