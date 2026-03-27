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

<div class="clients-view">
  <div class="clients-header">
    <h2 class="column-title">Kunden & Abrechnung</h2>
    <button class="btn-ghost" on:click={exportToFile} title="Alle Daten exportieren">↓ Export JSON</button>
  </div>

  {#if clients.length === 0}
    <p class="clients-empty">Noch keine Kunden. Lege Kunden unter „Projekte" an.</p>
  {/if}

  {#each clients as client (client.id)}
    {@const totals = clientTotals(client.id)}
    {@const trackedHours = (totals.trackedSeconds / 3600).toFixed(1)}
    {@const plannedHours = (totals.plannedMinutes / 60).toFixed(1)}
    {@const amount = billing(totals.trackedSeconds, client.hourlyRate)}
    {@const projs = clientProjects(client.id)}
    <div class="client-billing-card card">
      <div class="client-billing-header">
        <span class="client-dot" style="background:{client.color}" />
        <h3 class="client-billing-name">{client.name}</h3>

        <label class="rate-label">
          Stundensatz
          <div class="rate-input-wrap">
            <input class="rate-input" type="number" min="0" step="5"
              value={client.hourlyRate ?? ''}
              placeholder="–"
              on:input={(e) => handleRateChange(client.id, e.currentTarget.value)}
            />
            <span class="rate-currency">{client.currency ?? 'EUR'}</span>
          </div>
        </label>

        <div class="client-billing-totals">
          <span class="billing-kpi">
            <span class="billing-kpi-value">{trackedHours}h</span>
            <span class="billing-kpi-label">getrackt</span>
          </span>
          <span class="billing-kpi">
            <span class="billing-kpi-value">{plannedHours}h</span>
            <span class="billing-kpi-label">geplant</span>
          </span>
          {#if amount}
            <span class="billing-kpi billing-kpi--amount">
              <span class="billing-kpi-value">{amount} €</span>
              <span class="billing-kpi-label">Betrag</span>
            </span>
          {/if}
        </div>
        <button class="btn-ghost" on:click={() => exportClientCSV(client.id)}>↓ CSV</button>
      </div>

      {#if projs.length > 0}
        <table class="billing-table">
          <thead>
            <tr>
              <th>Projekt</th><th>Status</th><th>Tasks</th><th>Geplant</th><th>Getrackt</th>
              {#if client.hourlyRate}<th>Betrag</th>{/if}
            </tr>
          </thead>
          <tbody>
            {#each projs as p (p.id)}
              {@const s = projectStats(p.id)}
              {@const amt = billing(s.trackedSeconds, client.hourlyRate)}
              <tr>
                <td class="billing-project-name">
                  <span class="project-color-dot" style="background:{p.color}" />
                  {p.name}
                </td>
                <td><span class="status-badge status-badge--{p.status}">{p.status}</span></td>
                <td>{s.taskCount}</td>
                <td>{(s.plannedMinutes / 60).toFixed(1)}h</td>
                <td>{(s.trackedSeconds / 3600).toFixed(1)}h</td>
                {#if client.hourlyRate}<td class="billing-amount">{amt} €</td>{/if}
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  {/each}
</div>
