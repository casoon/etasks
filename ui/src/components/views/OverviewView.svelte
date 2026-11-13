<!-- @module:overview -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { $tasks as tasksStore } from '../../stores/taskStore';
  import { $timeEntries as timeEntriesStore, $activeEntry as activeEntryStore } from '../../stores/timerStore';
  import { $clients as clientsStore, $projects as projectsStore, $selectedProjectId as selectedProjectIdStore } from '../../stores/projectStore';
  import { $invoices as invoicesStore, $selectedInvoiceId as selectedInvoiceIdStore } from '../../stores/invoiceStore';
  import { $navItem as navItemStore, openToday } from '../../stores/uiStore';
  import { isoWeekNumber, toDateKey } from '../../domain/dateUtils';
  import { formatEuro } from '../../lib/invoiceMoney';
  import { DISPLAY_STATUS_LABEL, openSummary } from '../../lib/invoiceStatus';
  import {
    activeProjectRows,
    openInvoiceRows,
    overdueNote,
    taskTile,
    timeTodayTile,
    todayRows,
    weekTile,
  } from '../../lib/overviewStats';
  import type { NavItem } from '../../domain/types';

  let nowMs = Date.now();
  onMount(() => {
    const id = setInterval(() => { nowMs = Date.now(); }, 30_000);
    return () => clearInterval(id);
  });

  $: todayKey = toDateKey(new Date(nowMs));
  $: dateLine = `${new Date(nowMs).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })} · KW ${isoWeekNumber(todayKey)}`;
  $: tasks = $tasksStore;
  $: entries = $timeEntriesStore;
  $: invoices = $invoicesStore;
  $: runningTaskId = $activeEntryStore?.taskId ?? null;

  $: summary = openSummary(invoices, todayKey);
  $: sentCount = invoices.filter((i) => i.status === 'sent').length;
  $: overdue = overdueNote(invoices, todayKey);
  $: tiles = [
    { label: 'Aufgaben heute', nav: 'today' as NavItem, ...taskTile(tasks, todayKey) },
    { label: 'Zeit heute', nav: 'time' as NavItem, ...timeTodayTile(tasks, entries, todayKey, nowMs) },
    { label: 'Diese Woche', nav: 'time' as NavItem, ...weekTile(tasks, entries, todayKey, nowMs) },
  ];
  $: rows = todayRows(tasks, $projectsStore, todayKey, runningTaskId);
  $: projects = activeProjectRows($projectsStore, $clientsStore, tasks, entries, todayKey, nowMs);
  $: invoiceRows = openInvoiceRows(invoices, $clientsStore, todayKey);

  const STATUS_BADGE = { overdue: 'et-badge-red', sent: 'et-badge-blue', draft: '', paid: 'et-badge-green' } as const;

  function openProject(id: string) {
    selectedProjectIdStore.set(id);
    navItemStore.set('projects');
  }

  function openInvoice(id: string) {
    selectedInvoiceIdStore.set(id);
    navItemStore.set('invoices');
  }
</script>

<div class="flex-1 overflow-y-auto">
  <div class="flex flex-col gap-5 px-8 pt-5 pb-7">
    <header class="flex flex-wrap items-center gap-3">
      <div class="flex-[1_1_280px] flex flex-col gap-0.5">
        <h1 class="text-[24px] font-bold tracking-[-0.01em] leading-tight">Übersicht</h1>
        <span class="text-[13px]" style="color:var(--et-text-3)">{dateLine}</span>
      </div>
      <button class="et-btn" on:click={() => openToday('plan')}>Tag planen</button>
      <button class="et-btn et-btn-primary" on:click={() => openToday('work')}>
        Weiterarbeiten
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>
      </button>
    </header>

    <div class="grid gap-4" style="grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr))">
      {#each tiles as tile (tile.label)}
        <a
          href="#{tile.nav}"
          class="et-tile gap-1.5 no-underline hover:bg-[var(--et-surface-sunken)]"
          style="color:var(--et-text)"
          on:click|preventDefault={() => (tile.nav === 'today' ? openToday('work') : navItemStore.set(tile.nav))}
        >
          <span class="et-tile-label">{tile.label}</span>
          <span class="text-[26px] font-bold leading-[1.15] tabular-nums">{tile.value}</span>
          <span class="et-tile-note">{tile.note}</span>
          {#if tile.percent !== null}
            <span class="flex h-1.5 rounded-[3px]" style="background:var(--et-track)" aria-hidden="true">
              <span class="rounded-[3px]" style="width:{tile.percent}%;background:var(--et-accent)"></span>
            </span>
          {/if}
        </a>
      {/each}
      <a
        href="#invoices"
        class="et-tile gap-1.5 no-underline hover:bg-[var(--et-surface-sunken)]"
        style="color:var(--et-text)"
        on:click|preventDefault={() => navItemStore.set('invoices')}
      >
        <span class="et-tile-label">Offene Rechnungen</span>
        <span class="text-[26px] font-bold leading-[1.15] tabular-nums">{formatEuro(summary.openCents)}</span>
        <span class="et-tile-note">{sentCount} gesendet</span>
        {#if overdue}<span class="text-[12px] font-semibold" style="color:var(--et-danger)">{overdue}</span>{/if}
      </a>
    </div>

    <div class="grid gap-4 items-start" style="grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr))">
      <section class="et-card flex flex-col" aria-labelledby="ov-today">
        <div class="flex items-center gap-3 px-4 py-3.5" style="border-bottom:1px solid var(--et-border-subtle)">
          <h2 id="ov-today" class="et-h2 flex-1">Heute</h2>
          <a href="#today" class="text-[13px] font-semibold no-underline" style="color:var(--et-accent)" on:click|preventDefault={() => openToday('work')}>Zum Tag →</a>
        </div>
        {#each rows as row, i (row.id)}
          <button
            class="et-row w-full flex items-center gap-3 min-h-[52px] px-4 text-left"
            style="{i === 0 ? 'border-top:0;' : ''}{row.state === 'running' ? 'background:var(--et-accent-soft)' : ''}"
            on:click={() => openToday('work')}
          >
            <span
              class="w-2 h-2 rounded-full shrink-0"
              style="background:{row.state === 'running' ? 'var(--et-accent)' : row.state === 'done' ? 'var(--et-success)' : 'var(--et-text-3)'}"
              aria-hidden="true"
            ></span>
            <span class="flex-1 min-w-0 flex flex-col">
              <span class="font-semibold truncate" class:line-through={row.state === 'done'}>{row.title}</span>
              {#if row.subtitle || row.state === 'unscheduled'}
                <span class="text-[12px]" style="color:{row.state === 'unscheduled' ? 'var(--et-warning-text)' : 'var(--et-text-3)'}">
                  {row.subtitle}{row.subtitle && row.state === 'unscheduled' ? ' · ' : ''}{row.state === 'unscheduled' ? 'noch ohne Zeitslot' : ''}
                </span>
              {/if}
            </span>
            {#if row.state === 'running'}
              <span class="text-[12px] font-semibold" style="color:var(--et-accent-strong)">läuft</span>
            {:else if row.hint}
              <span class="text-[13px] tabular-nums" style="color:var(--et-text-3)">{row.hint}</span>
            {/if}
          </button>
        {:else}
          <p class="px-4 py-5 text-[13px]" style="color:var(--et-text-3)">Für heute ist noch nichts geplant. „Tag planen“ füllt den Tag aus dem Pool.</p>
        {/each}
      </section>

      <section class="et-card flex flex-col" aria-labelledby="ov-projects">
        <div class="flex items-center gap-3 px-4 py-3.5" style="border-bottom:1px solid var(--et-border-subtle)">
          <h2 id="ov-projects" class="et-h2 flex-1">Aktive Projekte</h2>
          <a href="#projects" class="text-[13px] font-semibold no-underline" style="color:var(--et-accent)" on:click|preventDefault={() => navItemStore.set('projects')}>Alle Projekte →</a>
        </div>
        {#each projects as p, i (p.id)}
          <button class="et-row w-full flex flex-col gap-2 px-4 py-3.5 text-left" style={i === 0 ? 'border-top:0' : ''} on:click={() => openProject(p.id)}>
            <span class="flex items-center gap-2.5 w-full">
              <span class="w-2.5 h-2.5 rounded-[3px] shrink-0" style="background:{p.color}" aria-hidden="true"></span>
              <span class="flex-1 min-w-0 font-semibold truncate">{p.name}</span>
              {#if p.deadline}
                <span class="et-badge {p.deadlineState === 'overdue' ? 'et-badge-red' : p.deadlineState === 'soon' ? 'et-badge-yellow' : ''}">Deadline {p.deadline}</span>
              {/if}
            </span>
            <span class="flex gap-3 text-[12px]" style="color:var(--et-text-3)">
              {#if p.clientName}<span>{p.clientName}</span>{/if}
              <span>{p.done} / {p.total} erledigt</span>
              <span>{p.trackedLabel}</span>
            </span>
            <span class="flex h-1.5 w-full rounded-[3px]" style="background:var(--et-track)" aria-hidden="true">
              <span class="rounded-[3px]" style="width:{p.percent}%;background:{p.color}"></span>
            </span>
          </button>
        {:else}
          <p class="px-4 py-5 text-[13px]" style="color:var(--et-text-3)">Keine aktiven Projekte.</p>
        {/each}
      </section>

      <section class="et-card flex flex-col" aria-labelledby="ov-billing">
        <div class="flex items-center gap-3 px-4 py-3.5" style="border-bottom:1px solid var(--et-border-subtle)">
          <h2 id="ov-billing" class="et-h2 flex-1">Abrechnung</h2>
          <a href="#invoices" class="text-[13px] font-semibold no-underline" style="color:var(--et-accent)" on:click|preventDefault={() => navItemStore.set('invoices')}>Alle Rechnungen →</a>
        </div>
        {#each invoiceRows as inv, i (inv.id)}
          <button class="et-row w-full flex items-center gap-3 min-h-[52px] px-4 text-left" style={i === 0 ? 'border-top:0' : ''} on:click={() => openInvoice(inv.id)}>
            <span class="flex-1 min-w-0 flex flex-col">
              <span class="font-semibold truncate">{inv.number}</span>
              <span class="text-[12px] truncate" style="color:var(--et-text-3)">{inv.clientName}</span>
            </span>
            <span class="et-badge {STATUS_BADGE[inv.status]}">{DISPLAY_STATUS_LABEL[inv.status]}</span>
            <span class="font-semibold tabular-nums">{formatEuro(inv.cents)}</span>
          </button>
        {:else}
          <p class="px-4 py-5 text-[13px]" style="color:var(--et-text-3)">Keine offenen Rechnungen.</p>
        {/each}
      </section>
    </div>
  </div>
</div>
