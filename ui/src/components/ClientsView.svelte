<script lang="ts">
  import { $clients as clientsStore, $projects as projectsStore, updateClient } from '../stores/projectStore';
  import { $tasks as tasksStore } from '../stores/taskStore';
  import { $timeEntries as timeEntriesStore } from '../stores/timerStore';
  import { formatTrackedTime } from '../domain/dateUtils';
  import { exportToFile } from '../lib/exportService';

  $: clients = $clientsStore;
  $: projects = $projectsStore;
  $: tasks = $tasksStore;
  $: entries = $timeEntriesStore;

  function clientProjects(clientId: string) {
    return projects.filter(p => p.clientId === clientId);
  }

  function projectStats(projectId: string) {
    const projectTasks = tasks.filter(t => t.projectId === projectId);
    const projectEntries = entries.filter(e => {
      const task = tasks.find(t => t.id === e.taskId);
      return task?.projectId === projectId && e.stoppedAt;
    });
    const plannedMinutes = projectTasks.reduce((s, t) => s + t.duration, 0);
    const trackedSeconds = projectEntries.reduce((s, e) => s + e.durationSeconds, 0);
    return { plannedMinutes, trackedSeconds, taskCount: projectTasks.length };
  }

  function clientTotals(clientId: string) {
    return clientProjects(clientId).reduce((acc, p) => {
      const s = projectStats(p.id);
      return { plannedMinutes: acc.plannedMinutes + s.plannedMinutes, trackedSeconds: acc.trackedSeconds + s.trackedSeconds };
    }, { plannedMinutes: 0, trackedSeconds: 0 });
  }

  function billing(trackedSeconds: number, hourlyRate?: number) {
    if (!hourlyRate) return null;
    return ((trackedSeconds / 3600) * hourlyRate).toFixed(2);
  }

  function exportClientCSV(clientId: string) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    const rows = [['Projekt', 'Status', 'Geplant (h)', 'Getrackt (h)', 'Betrag (EUR)']];
    for (const p of clientProjects(clientId)) {
      const s = projectStats(p.id);
      rows.push([p.name, p.status, (s.plannedMinutes / 60).toFixed(2), (s.trackedSeconds / 3600).toFixed(2), client.hourlyRate ? ((s.trackedSeconds / 3600) * client.hourlyRate).toFixed(2) : '']);
    }
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${client.name.replace(/\s+/g, '-')}-abrechnung.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  let rateDebounces: Record<string, ReturnType<typeof setTimeout>> = {};
  function handleRateChange(clientId: string, value: string) {
    clearTimeout(rateDebounces[clientId]);
    rateDebounces[clientId] = setTimeout(() => {
      const rate = parseFloat(value);
      updateClient(clientId, { hourlyRate: isNaN(rate) ? undefined : rate });
    }, 600);
  }
</script>

<div class="flex-1 flex flex-col overflow-hidden">
  <div class="flex items-center gap-3 px-6 py-4 border-b border-border flex-shrink-0">
    <h2 class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted flex-1">Kunden & Abrechnung</h2>
    <button
      class="px-3 py-1 text-secondary rounded-lg text-[13px] hover:bg-gray-100 transition-colors"
      on:click={exportToFile}
      title="Alle Daten exportieren"
    >↓ Export JSON</button>
  </div>

  <div class="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
    {#if clients.length === 0}
      <p class="text-[13px] text-muted p-6">Noch keine Kunden. Lege Kunden unter „Projekte" an.</p>
    {/if}

    {#each clients as client (client.id)}
      {@const totals = clientTotals(client.id)}
      {@const trackedHours = (totals.trackedSeconds / 3600).toFixed(1)}
      {@const plannedHours = (totals.plannedMinutes / 60).toFixed(1)}
      {@const amount = billing(totals.trackedSeconds, client.hourlyRate)}
      {@const projs = clientProjects(client.id)}
      <div class="bg-surface border border-border rounded-xl overflow-hidden">
        <div class="flex items-center gap-3 px-4 py-4 border-b border-border bg-bg">
          <span class="w-[10px] h-[10px] rounded-full flex-shrink-0" style="background:{client.color}" />
          <h3 class="text-sm font-semibold text-primary flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{client.name}</h3>

          <label class="text-[12px] text-secondary flex items-center gap-2">
            Stundensatz
            <div class="flex items-center gap-1">
              <input
                class="w-[80px] px-2 py-[3px] border border-border rounded-lg text-[12px] bg-bg outline-none tabular-nums focus:border-accent"
                type="number" min="0" step="5"
                value={client.hourlyRate ?? ''}
                placeholder="–"
                on:input={(e) => handleRateChange(client.id, e.currentTarget.value)}
              />
              <span class="text-[12px] text-muted">{client.currency ?? 'EUR'}</span>
            </div>
          </label>

          <div class="flex gap-4 ml-auto">
            <span class="flex flex-col items-center gap-[2px]">
              <span class="text-base font-bold text-primary tabular-nums whitespace-nowrap">{trackedHours}h</span>
              <span class="text-[10px] uppercase tracking-[0.06em] text-muted whitespace-nowrap">getrackt</span>
            </span>
            <span class="flex flex-col items-center gap-[2px]">
              <span class="text-base font-bold text-primary tabular-nums whitespace-nowrap">{plannedHours}h</span>
              <span class="text-[10px] uppercase tracking-[0.06em] text-muted whitespace-nowrap">geplant</span>
            </span>
            {#if amount}
              <span class="flex flex-col items-center gap-[2px]">
                <span class="text-base font-bold text-accent tabular-nums whitespace-nowrap">{amount} €</span>
                <span class="text-[10px] uppercase tracking-[0.06em] text-muted whitespace-nowrap">Betrag</span>
              </span>
            {/if}
          </div>
          <button
            class="px-3 py-1 text-secondary rounded-lg text-[13px] hover:bg-gray-100 transition-colors"
            on:click={() => exportClientCSV(client.id)}
          >↓ CSV</button>
        </div>

        {#if projs.length > 0}
          <table class="w-full text-[12px] border-collapse">
            <thead>
              <tr>
                <th class="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-[0.06em] text-muted border-b border-border-subtle">Projekt</th>
                <th class="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-[0.06em] text-muted border-b border-border-subtle">Status</th>
                <th class="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-[0.06em] text-muted border-b border-border-subtle">Tasks</th>
                <th class="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-[0.06em] text-muted border-b border-border-subtle">Geplant</th>
                <th class="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-[0.06em] text-muted border-b border-border-subtle">Getrackt</th>
                {#if client.hourlyRate}<th class="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-[0.06em] text-muted border-b border-border-subtle">Betrag</th>{/if}
              </tr>
            </thead>
            <tbody>
              {#each projs as p (p.id)}
                {@const s = projectStats(p.id)}
                {@const amt = billing(s.trackedSeconds, client.hourlyRate)}
                <tr class="hover:[&>td]:bg-bg">
                  <td class="px-4 py-2 text-secondary border-b border-border-subtle tabular-nums last:border-b-0">
                    <span class="flex items-center gap-2">
                      <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{p.color}" />
                      {p.name}
                    </span>
                  </td>
                  <td class="px-4 py-2 text-secondary border-b border-border-subtle tabular-nums last:border-b-0">
                    <span class="inline-block px-[6px] py-[1px] rounded-[10px] text-[10px] font-medium whitespace-nowrap
                      {p.status === 'active' ? 'bg-success-subtle text-success' : p.status === 'paused' ? 'bg-yellow-100 text-yellow-800' : 'bg-bg text-muted'}"
                    >{p.status}</span>
                  </td>
                  <td class="px-4 py-2 text-secondary border-b border-border-subtle tabular-nums last:border-b-0">{s.taskCount}</td>
                  <td class="px-4 py-2 text-secondary border-b border-border-subtle tabular-nums last:border-b-0">{(s.plannedMinutes / 60).toFixed(1)}h</td>
                  <td class="px-4 py-2 text-secondary border-b border-border-subtle tabular-nums last:border-b-0">{(s.trackedSeconds / 3600).toFixed(1)}h</td>
                  {#if client.hourlyRate}<td class="px-4 py-2 font-semibold text-accent border-b border-border-subtle tabular-nums last:border-b-0">{amt} €</td>{/if}
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    {/each}
  </div>
</div>
