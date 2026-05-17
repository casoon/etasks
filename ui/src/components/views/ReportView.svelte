<!-- @module:reporting -->
<script lang="ts">
  import { $tasks as tasksStore } from '../../stores/taskStore';
  import { $timeEntries as timeEntriesStore } from '../../stores/timerStore';
  import { $projects as projectsStore, $clients as clientsStore } from '../../stores/projectStore';

  type ReportMode = 'personal' | 'client';

  let mode: ReportMode = 'personal';
  let scopeType: 'all' | 'project' = 'all';
  let selectedProjectId = '';
  let selectedClientId = '';
  let dateFrom = (() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  })();
  let dateTo = new Date().toISOString().slice(0, 10);

  $: tasks = $tasksStore;
  $: timeEntries = $timeEntriesStore;
  $: projects = $projectsStore;
  $: clients = $clientsStore;

  $: clientProjects = selectedClientId
    ? projects.filter(p => p.clientId === selectedClientId)
    : projects;

  // Rows: completed tasks within date range, with time data
  interface ReportRow {
    taskId: string;
    title: string;
    projectName: string;
    clientName: string;
    projectColor: string;
    completedDate: string;
    durationMinutes: number;
  }

  $: rows = (() => {
    const projectMap = new Map(projects.map(p => [p.id, p]));
    const clientMap = new Map(clients.map(c => [c.id, c]));

    // Sum time entries per task
    const taskDuration = new Map<string, number>();
    for (const entry of timeEntries) {
      if (!entry.durationMinutes) continue;
      taskDuration.set(entry.taskId, (taskDuration.get(entry.taskId) ?? 0) + entry.durationMinutes);
    }

    const result: ReportRow[] = [];

    for (const task of tasks) {
      if (task.status !== 'done') continue;

      // Date filter: use updatedAt as completion proxy
      const completedDate = task.updatedAt.slice(0, 10);
      if (completedDate < dateFrom || completedDate > dateTo) continue;

      // Scope filter
      if (scopeType === 'project' && selectedProjectId && task.projectId !== selectedProjectId) continue;

      // Client scope filter (client mode + client selected)
      if (mode === 'client' && selectedClientId) {
        const proj = task.projectId ? projectMap.get(task.projectId) : null;
        if (!proj || proj.clientId !== selectedClientId) continue;
      }

      const proj = task.projectId ? projectMap.get(task.projectId) : null;
      const client = proj?.clientId ? clientMap.get(proj.clientId) : null;

      result.push({
        taskId: task.id,
        title: task.title,
        projectName: proj?.name ?? '—',
        clientName: client?.name ?? '—',
        projectColor: proj?.color ?? '#6366f1',
        completedDate,
        durationMinutes: taskDuration.get(task.id) ?? task.estimatedMinutes ?? 0,
      });
    }

    result.sort((a, b) => a.completedDate.localeCompare(b.completedDate));
    return result;
  })();

  $: totalMinutes = rows.reduce((sum, r) => sum + r.durationMinutes, 0);

  function formatDuration(minutes: number): string {
    if (!minutes) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} h`;
    return `${h} h ${m} min`;
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // Client report text for copy
  $: clientReportText = (() => {
    if (mode !== 'client') return '';
    const client = selectedClientId ? clients.find(c => c.id === selectedClientId) : null;
    const header = client
      ? `Tätigkeitsbericht für ${client.name}\nZeitraum: ${formatDate(dateFrom)} – ${formatDate(dateTo)}\n\n`
      : `Tätigkeitsbericht\nZeitraum: ${formatDate(dateFrom)} – ${formatDate(dateTo)}\n\n`;

    const grouped = new Map<string, ReportRow[]>();
    for (const row of rows) {
      const key = row.projectName;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    }

    let body = '';
    for (const [projectName, projectRows] of grouped) {
      body += `${projectName}\n`;
      for (const row of projectRows) {
        const dur = row.durationMinutes ? ` (${formatDuration(row.durationMinutes)})` : '';
        body += `  • ${formatDate(row.completedDate)}  ${row.title}${dur}\n`;
      }
      const projectMinutes = projectRows.reduce((s, r) => s + r.durationMinutes, 0);
      if (projectMinutes) body += `  Gesamt: ${formatDuration(projectMinutes)}\n`;
      body += '\n';
    }

    body += `Gesamtaufwand: ${formatDuration(totalMinutes)}`;
    return header + body;
  })();

  let copySuccess = false;
  async function copyToClipboard() {
    await navigator.clipboard.writeText(clientReportText);
    copySuccess = true;
    setTimeout(() => { copySuccess = false; }, 2000);
  }
</script>

<div class="flex flex-col h-full overflow-hidden">
  <!-- Header -->
  <div class="flex items-center gap-3 px-6 pt-5 pb-4 flex-shrink-0 border-b border-border">
    <h1 class="text-[13px] font-bold uppercase tracking-[0.07em] text-muted flex-shrink-0">Berichte</h1>

    <!-- Mode toggle -->
    <div class="flex rounded-lg border border-border overflow-hidden text-[12px] ml-2">
      <button
        class="px-3 py-1.5 transition-colors {mode === 'personal' ? 'bg-accent text-white font-semibold' : 'bg-surface text-secondary hover:text-primary'}"
        on:click={() => { mode = 'personal'; selectedClientId = ''; }}
      >Eigene Übersicht</button>
      <button
        class="px-3 py-1.5 transition-colors border-l border-border {mode === 'client' ? 'bg-accent text-white font-semibold' : 'bg-surface text-secondary hover:text-primary'}"
        on:click={() => { mode = 'client'; }}
      >Kundenbericht</button>
    </div>

    <div class="flex-1" />

    <!-- Date range -->
    <div class="flex items-center gap-2 text-[12px]">
      <span class="text-muted">Von</span>
      <input type="date" class="border border-border rounded-md px-2 py-1 text-[12px] bg-bg outline-none focus:border-accent" bind:value={dateFrom} />
      <span class="text-muted">Bis</span>
      <input type="date" class="border border-border rounded-md px-2 py-1 text-[12px] bg-bg outline-none focus:border-accent" bind:value={dateTo} />
    </div>
  </div>

  <!-- Filters row -->
  <div class="flex items-center gap-3 px-6 py-3 flex-shrink-0 border-b border-border bg-surface">
    {#if mode === 'client'}
      <div class="flex items-center gap-2 text-[12px]">
        <span class="text-muted font-medium">Kunde</span>
        <select class="border border-border rounded-md px-2 py-1 text-[12px] bg-bg outline-none focus:border-accent" bind:value={selectedClientId} on:change={() => { selectedProjectId = ''; scopeType = selectedProjectId ? 'project' : 'all'; }}>
          <option value="">Alle Kunden</option>
          {#each clients as c (c.id)}
            <option value={c.id}>{c.name}</option>
          {/each}
        </select>
      </div>
    {/if}

    <div class="flex items-center gap-2 text-[12px]">
      <span class="text-muted font-medium">Projekt</span>
      <select
        class="border border-border rounded-md px-2 py-1 text-[12px] bg-bg outline-none focus:border-accent"
        bind:value={selectedProjectId}
        on:change={() => { scopeType = selectedProjectId ? 'project' : 'all'; }}
      >
        <option value="">Alle Projekte</option>
        {#each (mode === 'client' && selectedClientId ? clientProjects : projects).filter(p => p.status === 'active' || p.status === 'done') as p (p.id)}
          <option value={p.id}>{p.name}</option>
        {/each}
      </select>
    </div>

    <div class="flex-1" />

    <div class="text-[12px] text-muted">
      {rows.length} Aufgabe{rows.length !== 1 ? 'n' : ''} ·
      <span class="font-semibold text-primary">{formatDuration(totalMinutes)}</span> gesamt
    </div>

    {#if mode === 'client' && rows.length > 0}
      <button
        class="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors {copySuccess ? 'bg-green-500 text-white' : 'bg-accent text-white hover:opacity-90'}"
        on:click={copyToClipboard}
      >{copySuccess ? '✓ Kopiert' : '⎘ Als Text kopieren'}</button>
    {/if}
  </div>

  <!-- Table -->
  <div class="flex-1 overflow-y-auto">
    {#if rows.length === 0}
      <div class="flex flex-col items-center justify-center h-full gap-2 text-center">
        <p class="text-[13px] text-muted">Keine erledigten Aufgaben im gewählten Zeitraum.</p>
        <p class="text-[12px] text-muted/70">Zeitraum oder Filter anpassen.</p>
      </div>
    {:else}
      <table class="w-full text-[12px]">
        <thead class="sticky top-0 bg-surface border-b border-border">
          <tr>
            <th class="text-left px-6 py-2.5 text-muted font-medium">Datum</th>
            <th class="text-left px-3 py-2.5 text-muted font-medium">Aufgabe</th>
            <th class="text-left px-3 py-2.5 text-muted font-medium">Projekt</th>
            {#if mode === 'personal' || !selectedClientId}
              <th class="text-left px-3 py-2.5 text-muted font-medium">Kunde</th>
            {/if}
            <th class="text-right px-6 py-2.5 text-muted font-medium">Dauer</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row (row.taskId)}
            <tr class="border-b border-border-subtle hover:bg-surface/50 transition-colors">
              <td class="px-6 py-2.5 text-secondary whitespace-nowrap">{formatDate(row.completedDate)}</td>
              <td class="px-3 py-2.5 text-primary font-medium max-w-[280px]">
                <span class="block truncate" title={row.title}>{row.title}</span>
              </td>
              <td class="px-3 py-2.5 text-secondary">
                <span class="flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{row.projectColor}" />
                  {row.projectName}
                </span>
              </td>
              {#if mode === 'personal' || !selectedClientId}
                <td class="px-3 py-2.5 text-muted">{row.clientName}</td>
              {/if}
              <td class="px-6 py-2.5 text-right text-secondary tabular-nums">{formatDuration(row.durationMinutes)}</td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr class="border-t border-border bg-surface">
            <td colspan={mode === 'personal' || !selectedClientId ? 4 : 3} class="px-6 py-2.5 text-[11px] text-muted font-medium uppercase tracking-wide">Gesamt</td>
            <td class="px-6 py-2.5 text-right font-bold text-primary tabular-nums">{formatDuration(totalMinutes)}</td>
          </tr>
        </tfoot>
      </table>
    {/if}
  </div>
</div>