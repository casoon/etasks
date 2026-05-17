<!-- @module:time-tracking -->
<script lang="ts">
  import { $timeEntries as timeEntriesStore, $activeEntry as activeEntryStore, stopActiveTimer } from '../../stores/timerStore';
  import { $tasks as tasksStore } from '../../stores/taskStore';
  import { $projects as projectsStore } from '../../stores/projectStore';
  import { formatTrackedTime } from '../../domain/dateUtils';
  import { formatTime, toDateKey } from '../../domain/dateUtils';

  $: entries = $timeEntriesStore;
  $: tasks = $tasksStore;
  $: projects = $projectsStore;
  $: activeEntry = $activeEntryStore;

  $: finished = entries.filter(e => e.endAt).sort(
    (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()
  );

  $: byDate = (() => {
    const map: Record<string, typeof finished> = {};
    for (const entry of finished) {
      const d = toDateKey(new Date(entry.startAt));
      map[d] = map[d] ?? [];
      map[d].push(entry);
    }
    return map;
  })();

  const weekMs = 7 * 24 * 60 * 60 * 1000;
  $: weekSeconds = finished
    .filter(e => new Date(e.startAt).getTime() > Date.now() - weekMs)
    .reduce((s, e) => s + (e.durationMinutes ?? 0) * 60, 0);

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

<div class="flex-1 flex flex-col overflow-hidden">
  {#if activeEntry}
    {@const activeTask = getTask(activeEntry.taskId)}
    <div class="flex items-center gap-3 px-6 py-2 bg-accent-subtle border-b border-border text-[13px] text-accent flex-shrink-0">
      <span class="w-2 h-2 rounded-full bg-accent flex-shrink-0 animate-pulse" />
      <span class="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">Läuft: {activeTask?.title ?? 'Unbekannte Aufgabe'}</span>
      <button
        class="px-3 py-1 text-secondary rounded-lg text-[13px] hover:bg-gray-100 transition-colors flex-shrink-0"
        on:click={stopActiveTimer}
      >⏹ Stoppen</button>
    </div>
  {/if}

  <div class="flex gap-3 flex-wrap px-6 py-4 border-b border-border flex-shrink-0">
    <div class="bg-surface border border-border rounded-xl px-4 py-3 flex flex-col gap-1 min-w-[120px]">
      <span class="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">Diese Woche</span>
      <span class="text-[22px] font-bold text-primary tabular-nums">{formatTrackedTime(weekSeconds)}</span>
    </div>
    <div class="bg-surface border border-border rounded-xl px-4 py-3 flex flex-col gap-1 min-w-[120px]">
      <span class="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">Einträge gesamt</span>
      <span class="text-[22px] font-bold text-primary tabular-nums">{finished.length}</span>
    </div>
  </div>

  <div class="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-6">
    {#if Object.keys(byDate).length === 0}
      <div class="flex flex-col items-center gap-4 py-10 px-6 text-center">
        <p class="text-[13px] text-muted leading-relaxed max-w-xs">Noch keine Zeiteinträge. Öffne die Tagesplanung, wähle eine Aufgabe und starte den Timer über den ▶-Button.</p>
        <button
          class="px-4 py-2 rounded-lg border border-border text-[13px] text-secondary hover:bg-bg hover:text-primary transition-colors"
          on:click={() => window.dispatchEvent(new CustomEvent('etasks:nav', { detail: 'planning-daily' }))}
        >Zur Tagesplanung →</button>
      </div>
    {/if}

    {#each Object.entries(byDate) as [date, dateEntries] (date)}
      {@const dayTotal = dateEntries.reduce((s, e) => s + (e.durationMinutes ?? 0) * 60, 0)}
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between pb-2 border-b border-border-subtle">
          <span class="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">{dateLabel(date)}</span>
          <span class="text-[12px] font-semibold text-secondary tabular-nums">{formatTrackedTime(dayTotal)}</span>
        </div>
        {#each dateEntries as entry (entry.id)}
          {@const task = getTask(entry.taskId)}
          {@const project = getProject(entry.projectId ?? task?.projectId)}
          <div class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-bg">
            {#if project}<span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{project.color}" />{/if}
            <span class="flex-1 text-[13px] text-primary overflow-hidden text-ellipsis whitespace-nowrap min-w-0">{task?.title ?? '—'}</span>
            {#if project}<span class="text-[11px] text-muted whitespace-nowrap">{project.name}</span>{/if}
            <span class="text-[11px] text-muted whitespace-nowrap">{formatTime(entry.startAt)} – {entry.endAt ? formatTime(entry.endAt) : '…'}</span>
            <span class="text-[12px] font-semibold text-secondary tabular-nums whitespace-nowrap">{formatTrackedTime((entry.durationMinutes ?? 0) * 60)}</span>
          </div>
        {/each}
      </div>
    {/each}
  </div>
</div>