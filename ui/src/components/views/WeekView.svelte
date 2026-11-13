<!-- @module:planning -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { $tasks as tasksStore, $activeDate as activeDateStore } from '../../stores/taskStore';
  import { $bridgeTimeEntries as timeEntriesStore } from '../../stores/coreBridge';
  import { $projects as projectsStore } from '../../stores/projectStore';
  import { $navItem as navItemStore, openToday } from '../../stores/uiStore';
  import { addDaysToKey, formatHm, getWeekStart, isoWeekNumber, today } from '../../domain/dateUtils';
  import { tasksPlannedInWeek, trackedMinutesByTag } from '../../lib/analyticsService';
  import {
    WEEKDAY_LABELS,
    customerMinutes,
    dayBars,
    formatWeekRange,
    leadTimeStats,
    trackedMinutesByProject,
    weekDayKeys,
  } from '../../lib/weekStats';
  import WeekGoals from './WeekGoals.svelte';
  import WeekPlanPanel from './WeekPlanPanel.svelte';

  let weekStart = getWeekStart(new Date());
  let breakdown: 'project' | 'category' = 'project';

  let nowMs = Date.now();
  onMount(() => {
    const id = setInterval(() => { nowMs = Date.now(); }, 30_000);
    return () => clearInterval(id);
  });

  $: weekEnd = addDaysToKey(weekStart, 6);
  $: isCurrentWeek = weekStart === getWeekStart(new Date(nowMs));
  $: days = weekDayKeys(weekStart);
  $: tasks = $tasksStore;
  $: entries = $timeEntriesStore;
  $: projects = $projectsStore;

  $: weekTasks = tasksPlannedInWeek(tasks, weekStart, weekEnd);
  $: doneCount = weekTasks.filter((t) => t.status === 'done').length;
  $: plannedMinutes = weekTasks.reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0);
  $: bars = dayBars(days, tasks, entries, nowMs);
  $: trackedMinutes = bars.reduce((s, b) => s + b.trackedMinutes, 0);
  $: split = customerMinutes(entries, projects, weekStart, weekEnd, nowMs);
  $: byProject = trackedMinutesByProject(entries, projects, weekStart, weekEnd, nowMs);
  $: projectTotal = byProject.reduce((s, p) => s + p.minutes, 0);
  $: byTag = Object.entries(trackedMinutesByTag(entries, tasks, weekStart, weekEnd))
    .map(([tag, minutes]) => ({ tag, minutes: Math.round(minutes) }))
    .sort((a, b) => b.minutes - a.minutes);
  $: tagTotal = byTag.reduce((s, t) => s + t.minutes, 0);
  $: barMax = Math.max(60, ...bars.map((b) => Math.max(b.plannedMinutes, b.trackedMinutes)));
  $: leadTime = leadTimeStats(tasks, projects);

  function shiftWeek(n: number) {
    weekStart = addDaysToKey(weekStart, 7 * n);
  }

  function dayLabel(key: string): string {
    return new Date(`${key}T00:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function openDay(key: string) {
    activeDateStore.set(key);
    openToday(key <= today() ? 'work' : 'plan');
  }
</script>

<div class="flex-1 overflow-y-auto">
  <div class="flex flex-col gap-5 px-8 pt-5 pb-7">
    <header class="flex flex-wrap items-center gap-3">
      <div class="flex-1 min-w-[260px] flex flex-col gap-0.5">
        <h1 class="text-[24px] font-bold tracking-[-0.01em] leading-tight">Woche</h1>
        <span class="text-[13px]" style="color:var(--et-text-3)">KW {isoWeekNumber(weekStart)} · {formatWeekRange(weekStart)}</span>
      </div>
      <div class="flex items-center gap-1">
        <button class="et-btn et-btn-icon" style="border-color:var(--et-border)" aria-label="Vorherige Woche" on:click={() => shiftWeek(-1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"></path></svg>
        </button>
        <button class="et-btn" style="border-color:var(--et-border)" disabled={isCurrentWeek} on:click={() => (weekStart = getWeekStart(new Date()))}>Diese Woche</button>
        <button class="et-btn et-btn-icon" style="border-color:var(--et-border)" aria-label="Nächste Woche" on:click={() => shiftWeek(1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>
        </button>
      </div>
    </header>

    <div class="flex flex-wrap gap-5 items-start">
      <div class="flex-[1_1_360px] max-w-[440px] min-w-0 flex flex-col gap-4">
        <WeekGoals {weekStart} />
        <WeekPlanPanel {weekStart} />
      </div>

      <div class="flex-[999_1_420px] min-w-0 flex flex-col gap-4">
        <div class="grid gap-4" style="grid-template-columns:repeat(auto-fit,minmax(min(170px,100%),1fr))">
          <div class="et-tile">
            <span class="et-tile-label">Erfasst</span>
            <span class="et-tile-value">{formatHm(trackedMinutes)}</span>
            <span class="et-tile-note">von {formatHm(plannedMinutes)} geplant</span>
          </div>
          <div class="et-tile">
            <span class="et-tile-label">Erledigt</span>
            <span class="et-tile-value">{doneCount} von {weekTasks.length}</span>
            <span class="et-tile-note">Aufgaben dieser Woche</span>
          </div>
          <div class="et-tile">
            <span class="et-tile-label">Für Kunden</span>
            <span class="et-tile-value">{formatHm(split.customer)}</span>
            <span class="et-tile-note">{formatHm(split.internal)} intern</span>
          </div>
        </div>

        <section aria-label="Geplant und erfasst je Tag" class="et-card flex flex-col gap-3 px-5 pt-4 pb-4.5">
          <div class="flex flex-wrap items-center gap-4">
            <h2 class="et-h2 flex-[1_1_160px]">Geplant und erfasst</h2>
            <span class="flex items-center gap-1.5 text-[12px]" style="color:var(--et-text-3)"><span class="w-3 h-3 rounded-[3px]" style="background:#C9D3EC" aria-hidden="true"></span>Geplant</span>
            <span class="flex items-center gap-1.5 text-[12px]" style="color:var(--et-text-3)"><span class="w-3 h-3 rounded-[3px]" style="background:var(--et-accent)" aria-hidden="true"></span>Erfasst</span>
          </div>
          <div class="flex items-end gap-3.5 h-[200px] border-b" style="border-color:var(--et-border)">
            {#each bars as bar (bar.date)}
              <button
                class="flex-1 h-full flex items-end gap-1 rounded-t-md transition-colors hover:bg-[var(--et-surface-sunken)]"
                aria-label="{dayLabel(bar.date)}: {formatHm(bar.trackedMinutes)} erfasst, {formatHm(bar.plannedMinutes)} geplant. Tag in Heute öffnen"
                on:click={() => openDay(bar.date)}
              >
                <span class="flex-1 rounded-t-[4px]" style="height:{(bar.plannedMinutes / barMax) * 100}%;background:#C9D3EC" aria-hidden="true"></span>
                <span class="flex-1 rounded-t-[4px]" style="height:{(bar.trackedMinutes / barMax) * 100}%;background:var(--et-accent)" aria-hidden="true"></span>
              </button>
            {/each}
          </div>
          <div class="flex gap-3.5 text-center text-[12px]" style="color:var(--et-text-3)">
            {#each bars as bar, i (bar.date)}
              <span class="flex-1 flex flex-col">
                <span class="font-semibold" style="color:{bar.date === today() ? 'var(--et-accent-strong)' : 'var(--et-text)'}">{WEEKDAY_LABELS[i]}</span>
                <span class="tabular-nums">{bar.trackedMinutes > 0 ? formatHm(bar.trackedMinutes) : '–'}</span>
              </span>
            {/each}
          </div>
        </section>

        <section aria-label="Zeit nach {breakdown === 'project' ? 'Projekt' : 'Kategorie'}" class="et-card flex flex-col gap-3 px-5 pt-4 pb-4.5">
          <div class="flex flex-wrap items-center gap-3">
            <h2 class="et-h2 flex-1">Zeit nach {breakdown === 'project' ? 'Projekt' : 'Kategorie'}</h2>
            <div class="et-seg" role="group" aria-label="Aufteilung">
              <button aria-pressed={breakdown === 'project'} on:click={() => (breakdown = 'project')}>Projekt</button>
              <button aria-pressed={breakdown === 'category'} on:click={() => (breakdown = 'category')}>Kategorie</button>
            </div>
            <button class="text-[13px] font-semibold min-h-11 px-1" style="color:var(--et-accent)" on:click={() => navItemStore.set('reports')}>Als Bericht öffnen →</button>
          </div>

          {#if breakdown === 'project'}
            {#if byProject.length === 0}
              <p class="text-[13px]" style="color:var(--et-text-3)">Noch keine erfasste Zeit in dieser Woche.</p>
            {/if}
            {#each byProject as row (row.id)}
              <div class="flex items-center gap-3">
                <span class="w-[180px] flex-shrink-0 truncate" title={row.name}>{row.name}</span>
                <span class="flex-1 h-2.5 rounded-[5px] flex" style="background:var(--et-track)" aria-hidden="true"><span class="rounded-[5px]" style="width:{projectTotal > 0 ? (row.minutes / projectTotal) * 100 : 0}%;background:{row.color}"></span></span>
                <span class="w-16 text-right font-semibold tabular-nums">{formatHm(row.minutes)}</span>
              </div>
            {/each}
          {:else}
            {#if byTag.length === 0}
              <p class="text-[13px]" style="color:var(--et-text-3)">Noch keine erfasste Zeit in dieser Woche. Tags setzt du beim Bearbeiten einer Aufgabe (Doppelklick).</p>
            {/if}
            {#each byTag as row (row.tag)}
              <div class="flex items-center gap-3">
                <span class="w-[180px] flex-shrink-0 truncate" title={row.tag}>{row.tag}</span>
                <span class="flex-1 h-2.5 rounded-[5px] flex" style="background:var(--et-track)" aria-hidden="true"><span class="rounded-[5px]" style="width:{tagTotal > 0 ? (row.minutes / tagTotal) * 100 : 0}%;background:var(--et-accent)"></span></span>
                <span class="w-16 text-right font-semibold tabular-nums">{formatHm(row.minutes)}</span>
              </div>
            {/each}
          {/if}
        </section>

        <section aria-label="Durchlaufzeit" class="et-card flex flex-col gap-2 px-5 pt-4 pb-4.5">
          <div class="flex items-center gap-3">
            <h2 class="et-h2 flex-1">Durchlaufzeit</h2>
            <span class="text-[12px]" style="color:var(--et-text-3)">{leadTime.count} erledigte Aufgaben insgesamt</span>
          </div>
          <span class="text-[24px] font-bold">{leadTime.avgDays == null ? '–' : `${leadTime.avgDays} Tage`}</span>
          <span class="text-[13px]" style="color:var(--et-text-3)">Durchschnitt von Erstellung bis Abschluss, alle Wochen.</span>
          {#each leadTime.byProject as item (item.name)}
            <div class="flex items-center justify-between gap-3 text-[13px]">
              <span class="flex items-center gap-2 min-w-0"><span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{item.color}" aria-hidden="true"></span><span class="truncate">{item.name}</span></span>
              <span class="whitespace-nowrap" style="color:var(--et-text-3)">{item.avgDays} Tage · {item.count} Aufgaben</span>
            </div>
          {/each}
        </section>
      </div>
    </div>
  </div>
</div>
