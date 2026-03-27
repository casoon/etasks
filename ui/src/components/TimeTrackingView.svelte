<script lang="ts">
  import { $timeEntries as timeEntriesStore, $activeEntry as activeEntryStore, stopActiveTimer } from '../stores/timerStore';
  import { $tasks as tasksStore } from '../stores/taskStore';
  import { $projects as projectsStore } from '../stores/projectStore';
  import { formatTrackedTime } from '../domain/dateUtils';
  import { formatTime, toDateKey } from '../domain/dateUtils';

  $: entries = $timeEntriesStore;
  $: tasks = $tasksStore;
  $: projects = $projectsStore;
  $: activeEntry = $activeEntryStore;

  $: finished = entries.filter(e => e.stoppedAt).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );

  $: byDate = (() => {
    const map: Record<string, typeof finished> = {};
    for (const entry of finished) {
      const d = toDateKey(new Date(entry.startedAt));
      map[d] = map[d] ?? [];
      map[d].push(entry);
    }
    return map;
  })();

  const weekMs = 7 * 24 * 60 * 60 * 1000;
  $: weekSeconds = finished
    .filter(e => new Date(e.startedAt).getTime() > Date.now() - weekMs)
    .reduce((s, e) => s + e.durationSeconds, 0);

  function getTask(id: string) { return tasks.find(t => t.id === id); }
  function getProject(id?: string) { return id ? projects.find(p => p.id === id) : null; }

  function dateLabel(d: string) {
    const today = toDateKey(new Date());
    const yesterday = toDateKey(new Date(Date.now() - 86400000));
    if (d === today) return 'Heute';
    if (d === yesterday) return 'Gestern';
    return new Date(d + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'short' });
  }
</script>

<div class="time-tracking-view">
  {#if activeEntry}
    {@const activeTask = getTask(activeEntry.taskId)}
    <div class="active-timer-banner">
      <span class="active-timer-dot" />
      <span class="active-timer-text">Läuft: {activeTask?.title ?? 'Unbekannte Aufgabe'}</span>
      <button class="btn-ghost active-timer-stop" on:click={stopActiveTimer}>⏹ Stoppen</button>
    </div>
  {/if}

  <div class="time-tracking-kpis">
    <div class="kpi-card card">
      <span class="kpi-label">Diese Woche</span>
      <span class="kpi-value">{formatTrackedTime(weekSeconds)}</span>
    </div>
    <div class="kpi-card card">
      <span class="kpi-label">Einträge gesamt</span>
      <span class="kpi-value">{finished.length}</span>
    </div>
  </div>

  <div class="time-entry-groups">
    {#if Object.keys(byDate).length === 0}
      <p class="time-empty">Noch keine Zeiteinträge. Starte einen Timer über den ▶-Button auf einer Aufgabe.</p>
    {/if}

    {#each Object.entries(byDate) as [date, dateEntries] (date)}
      {@const dayTotal = dateEntries.reduce((s, e) => s + e.durationSeconds, 0)}
      <div class="time-entry-group">
        <div class="time-entry-group-header">
          <span class="time-entry-group-date">{dateLabel(date)}</span>
          <span class="time-entry-group-total">{formatTrackedTime(dayTotal)}</span>
        </div>
        {#each dateEntries as entry (entry.id)}
          {@const task = getTask(entry.taskId)}
          {@const project = getProject(entry.projectId ?? task?.projectId)}
          <div class="time-entry-row">
            {#if project}<span class="time-entry-dot" style="background:{project.color}" />{/if}
            <span class="time-entry-title">{task?.title ?? '—'}</span>
            {#if project}<span class="time-entry-project">{project.name}</span>{/if}
            <span class="time-entry-time">{formatTime(entry.startedAt)} – {entry.stoppedAt ? formatTime(entry.stoppedAt) : '…'}</span>
            <span class="time-entry-duration">{formatTrackedTime(entry.durationSeconds)}</span>
          </div>
        {/each}
      </div>
    {/each}
  </div>
</div>
