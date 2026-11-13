<!-- @module:reporting -->
<script lang="ts">
  import { $tasks as tasksStore } from '../../stores/taskStore';
  import { $timeEntries as timeEntriesStore } from '../../stores/timerStore';
  import { $projects as projectsStore, $clients as clientsStore } from '../../stores/projectStore';
  import { $termine as termineStore } from '../../stores/terminStore';
  import { formatDateDe, formatHm } from '../../domain/dateUtils';
  import {
    buildViewRows,
    detectPreset,
    formatDuration,
    periodLabel,
    presetRange,
    reportText,
    reportTotals,
    type PeriodPreset,
  } from '../../lib/reportView';
  import { toast } from '../../stores/toastStore';

  /** Creates an invoice draft for a client and period (wired by the app shell). */
  export let onCreateInvoice: (clientId: string, period: { from: string; to: string; label: string }) => void;

  type ReportMode = 'personal' | 'client';
  const PRESETS: { id: Exclude<PeriodPreset, 'custom'>; label: string }[] = [
    { id: 'week', label: 'Diese Woche' },
    { id: 'last-week', label: 'Letzte Woche' },
    { id: 'month', label: 'Dieser Monat' },
  ];

  let mode: ReportMode = 'client';
  let clientId = '';
  let projectId = '';
  let { from: dateFrom, to: dateTo } = presetRange('month', new Date());
  // „Eigener Zeitraum“ keeps the date fields open even when the range happens to match a preset.
  let customPicked = false;

  $: clients = $clientsStore;
  $: projects = $projectsStore;
  $: preset = customPicked ? 'custom' : detectPreset(dateFrom, dateTo, new Date());
  $: projectChoices = projects.filter((p) => (!clientId || p.clientId === clientId) && (p.status === 'active' || p.status === 'done'));
  $: if (projectId && !projectChoices.some((p) => p.id === projectId)) projectId = '';

  $: rows = buildViewRows(
    { tasks: $tasksStore, timeEntries: $timeEntriesStore, termine: $termineStore, projects, clients },
    { from: dateFrom, to: dateTo, clientId, projectId },
  );
  $: totals = reportTotals(rows);
  $: showClientColumn = mode === 'personal' || !clientId;
  $: client = clientId ? (clients.find((c) => c.id === clientId) ?? null) : null;
  // The client for an invoice: the chosen one, else the owner of the chosen project.
  $: invoiceClient = client ?? clients.find((c) => c.id === projects.find((p) => p.id === projectId)?.clientId) ?? null;

  function pick(id: Exclude<PeriodPreset, 'custom'>) {
    customPicked = false;
    ({ from: dateFrom, to: dateTo } = presetRange(id, new Date()));
  }

  let copied = false;
  async function copyText() {
    try {
      await navigator.clipboard.writeText(reportText(rows, mode === 'client' ? (client?.name ?? null) : null, dateFrom, dateTo));
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch (e) {
      toast(`Kopieren fehlgeschlagen: ${String(e)}`, 'error', 4000);
    }
  }

  function createInvoice() {
    if (!invoiceClient) return;
    onCreateInvoice(invoiceClient.id, { from: dateFrom, to: dateTo, label: periodLabel(dateFrom, dateTo) });
  }
</script>

<div class="flex-1 overflow-y-auto">
  <div class="flex flex-col gap-[18px] px-8 pt-5 pb-7">
    <header class="flex flex-wrap items-center gap-3">
      <div class="flex-[1_1_280px] flex flex-col gap-0.5">
        <h1 class="text-[24px] font-bold tracking-[-0.01em] leading-tight">Berichte</h1>
        <span class="text-[13px]" style="color:var(--et-text-3)">Was wurde wann für wen erledigt</span>
      </div>
      <button class="et-btn" disabled={rows.length === 0} on:click={copyText}>{copied ? 'Kopiert' : 'Als Text kopieren'}</button>
    </header>

    <section aria-label="Filter" class="et-card flex flex-col gap-3.5 px-5 py-4">
      <div class="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div class="et-seg" role="group" aria-label="Berichtsart">
          <button aria-pressed={mode === 'personal'} on:click={() => (mode = 'personal')}>Eigene Übersicht</button>
          <button aria-pressed={mode === 'client'} on:click={() => (mode = 'client')}>Kundenbericht</button>
        </div>
        <div class="flex flex-wrap gap-1.5" role="group" aria-label="Zeitraum">
          {#each PRESETS as p (p.id)}
            <button class="et-chip" aria-pressed={preset === p.id} on:click={() => pick(p.id)}>{p.label}</button>
          {/each}
          <button class="et-chip" aria-pressed={preset === 'custom'} on:click={() => (customPicked = true)}>Eigener Zeitraum</button>
        </div>
      </div>
      <div class="grid gap-x-4 gap-y-3.5" style="grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr))">
        <div class="flex flex-col gap-1.5">
          <label class="et-label" for="rp-from">Von</label>
          <input id="rp-from" class="et-field" type="date" lang="de" bind:value={dateFrom} />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="et-label" for="rp-to">Bis</label>
          <input id="rp-to" class="et-field" type="date" lang="de" bind:value={dateTo} />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="et-label" for="rp-client">Kunde</label>
          <select id="rp-client" class="et-field" bind:value={clientId}>
            <option value="">Alle Kunden</option>
            {#each clients as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
          </select>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="et-label" for="rp-project">Projekt</label>
          <select id="rp-project" class="et-field" bind:value={projectId}>
            <option value="">Alle Projekte</option>
            {#each projectChoices as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
          </select>
        </div>
      </div>
    </section>

    <dl class="flex flex-wrap gap-x-8 gap-y-3 px-1 m-0">
      <div class="flex flex-col"><dt class="text-[12px]" style="color:var(--et-text-3)">Einträge</dt><dd class="m-0 text-[18px] font-semibold tabular-nums">{totals.count}</dd></div>
      <div class="flex flex-col"><dt class="text-[12px]" style="color:var(--et-text-3)">Erfasst</dt><dd class="m-0 text-[18px] font-semibold tabular-nums">{formatHm(totals.trackedMinutes)}</dd></div>
      <div class="flex flex-col"><dt class="text-[12px]" style="color:var(--et-text-3)">Geschätzt</dt><dd class="m-0 text-[18px] font-semibold tabular-nums">{formatHm(totals.estimatedMinutes)}</dd></div>
      <div class="flex flex-col"><dt class="text-[12px]" style="color:var(--et-text-3)">Abrechenbare Termine</dt><dd class="m-0 text-[18px] font-semibold tabular-nums">{totals.terminCount} · {formatHm(totals.terminMinutes)}</dd></div>
    </dl>

    <div class="overflow-x-auto et-card">
      <table class="w-full min-w-[760px] border-collapse tabular-nums">
        <thead>
          <tr class="et-th text-left">
            <th class="px-5 py-2.5 font-semibold">Datum</th>
            <th class="px-3 py-2.5 font-semibold">Aufgabe</th>
            <th class="px-3 py-2.5 font-semibold">Projekt</th>
            {#if showClientColumn}<th class="px-3 py-2.5 font-semibold">Kunde</th>{/if}
            <th class="px-3 py-2.5 font-semibold text-right">Geschätzt</th>
            <th class="px-5 py-2.5 font-semibold text-right">Erfasst</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row (row.key)}
            <tr class="et-row">
              <td class="px-5 py-3.5 whitespace-nowrap">{formatDateDe(row.completedDate).slice(0, 6)}</td>
              <td class="px-3 py-3.5 font-medium max-w-[320px]">
                <span class="block truncate" title={row.title}>{row.title}</span>
                {#if !row.done}<span class="text-[12px] font-semibold" style="color:var(--et-warning-text)">offen</span>{/if}
              </td>
              <td class="px-3 py-3.5" style="color:var(--et-text-2)">
                <span class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-[3px] flex-shrink-0" style="background:{row.projectColor}" aria-hidden="true"></span>{row.projectName}
                </span>
              </td>
              {#if showClientColumn}<td class="px-3 py-3.5" style="color:var(--et-text-2)">{row.clientName}</td>{/if}
              <td class="px-3 py-3.5 text-right" style="color:var(--et-text-3)">{formatDuration(row.estimatedMinutes)}</td>
              <td class="px-5 py-3.5 text-right">{formatDuration(row.trackedMinutes)}</td>
            </tr>
          {/each}
          {#if rows.length === 0}
            <tr class="et-row"><td colspan={showClientColumn ? 6 : 5} class="px-5 py-8 text-[13px]" style="color:var(--et-text-3)">Keine erledigten Aufgaben oder erfasste Zeit im gewählten Zeitraum. Passe Zeitraum oder Filter an.</td></tr>
          {/if}
        </tbody>
        {#if rows.length > 0}
          <tfoot>
            <tr class="font-bold" style="border-top:2px solid var(--et-border)">
              <td colspan={showClientColumn ? 4 : 3} class="px-5 py-3.5">Gesamt</td>
              <td class="px-3 py-3.5 text-right">{formatDuration(totals.estimatedMinutes)}</td>
              <td class="px-5 py-3.5 text-right">{formatDuration(totals.trackedMinutes)}</td>
            </tr>
          </tfoot>
        {/if}
      </table>
    </div>

    <div class="flex flex-wrap items-center gap-3 text-[13px]">
      {#if invoiceClient}
        <span class="flex-[1_1_320px]" style="color:var(--et-text-3)">Rechnung für {invoiceClient.name} und den Zeitraum {periodLabel(dateFrom, dateTo)}: die erfasste Zeit lässt sich dort direkt übernehmen.</span>
        <button class="font-semibold min-h-11 px-1" style="color:var(--et-accent)" on:click={createInvoice}>Rechnung aus diesem Zeitraum erstellen →</button>
      {:else}
        <span class="flex-1" style="color:var(--et-text-3)">Wähle einen Kunden oder ein Projekt mit Kunde, um eine Rechnung für diesen Zeitraum zu erstellen.</span>
      {/if}
    </div>
  </div>
</div>
