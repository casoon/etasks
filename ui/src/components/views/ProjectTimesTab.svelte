<!-- @module:projects -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { $timeEntries as timeEntriesStore } from '../../stores/timerStore';
  import { $tasks as tasksStore } from '../../stores/taskStore';
  import { $termine as termineStore, addTermin, removeTermin } from '../../stores/terminStore';
  import { $navItem as navItemStore } from '../../stores/uiStore';
  import { entryTrackedSeconds } from '../../lib/dayStats';
  import { entryProjectId, groupByDay } from '../../lib/timeWeek';
  import { formatDate, formatDateDe, formatHm, formatTime, today } from '../../domain/dateUtils';
  import type { Project, TerminType } from '../../domain/types';

  export let project: Project;

  $: tasks = $tasksStore;
  $: entries = $timeEntriesStore.filter((e) => entryProjectId(e, tasks) === project.id);
  $: groups = groupByDay(entries);
  $: termine = $termineStore
    .filter((t) => t.projectId === project.id)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  const TYPE_LABELS: Record<TerminType, string> = { video: 'Video', phone: 'Telefon', onsite: 'Vor Ort' };

  let now = Date.now();
  onMount(() => {
    const id = setInterval(() => { now = Date.now(); }, 30_000);
    return () => clearInterval(id);
  });
  $: totalSeconds = entries.reduce((s, e) => s + entryTrackedSeconds(e, now), 0);

  // ── Termin form ──
  let adding = false;
  let title = '';
  let date = today();
  let time = '09:00';
  let duration = 60;
  let type: TerminType = 'video';
  let billable = false;

  function openForm() {
    adding = true;
    title = '';
    date = today();
    time = '09:00';
    duration = 60;
    type = 'video';
    billable = false;
  }

  function save() {
    if (!title.trim()) return;
    addTermin({ date, startTime: time, durationMinutes: duration, type, title: title.trim(), projectId: project.id, billable });
    adding = false;
  }
</script>

<div class="flex flex-col gap-4">
  <section class="et-card flex flex-col" aria-label="Zeiteinträge">
    <div class="flex flex-wrap items-center gap-3 px-5 py-3.5">
      <h2 class="et-h2 flex-1">Zeiteinträge · {formatHm(totalSeconds / 60)}</h2>
      <button class="et-btn et-btn-sm" on:click={() => navItemStore.set('time')}>In Zeiten bearbeiten</button>
    </div>
    {#if groups.length === 0}
      <div class="et-row px-5 py-6 text-[13px]" style="color:var(--et-text-3)">Für dieses Projekt wurde noch keine Zeit erfasst.</div>
    {/if}
    {#each groups as group (group.date)}
      <div class="et-row flex items-center gap-3 px-5 py-2.5" style="background:var(--et-surface-sunken)">
        <h3 class="flex-1 text-[13px] font-semibold">{formatDate(group.date)}</h3>
        <span class="text-[13px] font-semibold tabular-nums">{formatHm(group.entries.reduce((s, e) => s + entryTrackedSeconds(e, now), 0) / 60)}</span>
      </div>
      {#each group.entries as entry (entry.id)}
        {@const task = tasks.find((t) => t.id === entry.taskId)}
        <div class="et-row flex flex-wrap items-center gap-x-4 min-h-12 px-5 py-1.5" style={entry.endAt ? '' : 'background:var(--et-accent-soft)'}>
          <span class="flex-[1_1_220px] truncate font-medium">{task?.title ?? 'Gelöschte Aufgabe'}</span>
          <span class="text-[13px] tabular-nums">{formatTime(entry.startAt)} – {entry.endAt ? formatTime(entry.endAt) : 'jetzt'}</span>
          <span class="font-semibold tabular-nums min-w-[60px] text-right">{formatHm(entryTrackedSeconds(entry, now) / 60)}</span>
          {#if !entry.endAt}<span class="text-[12px] font-semibold" style="color:var(--et-accent-strong)">läuft</span>{/if}
        </div>
      {/each}
    {/each}
  </section>

  <section class="et-card flex flex-col" aria-label="Termine">
    <div class="flex flex-wrap items-center gap-3 px-5 py-3.5">
      <h2 class="et-h2 flex-1">Termine</h2>
      {#if !adding}<button class="et-btn et-btn-accent" on:click={openForm}>+ Termin</button>{/if}
    </div>

    {#if adding}
      <form class="et-row flex flex-wrap items-end gap-3 px-5 py-3" style="background:var(--et-accent-soft)" aria-label="Neuer Termin" on:submit|preventDefault={save}>
        <div class="flex-[2_1_220px] flex flex-col gap-1">
          <label class="et-label" for="pt-title">Titel</label>
          <!-- svelte-ignore a11y-autofocus -->
          <input id="pt-title" class="et-field" bind:value={title} autofocus />
        </div>
        <div class="flex-[1_1_130px] flex flex-col gap-1">
          <label class="et-label" for="pt-type">Art</label>
          <select id="pt-type" class="et-field" bind:value={type}>
            {#each Object.entries(TYPE_LABELS) as [id, label] (id)}<option value={id}>{label}</option>{/each}
          </select>
        </div>
        <div class="flex-[1_1_150px] flex flex-col gap-1">
          <label class="et-label" for="pt-date">Datum</label>
          <input id="pt-date" type="date" class="et-field" bind:value={date} />
        </div>
        <div class="flex-[1_1_110px] flex flex-col gap-1">
          <label class="et-label" for="pt-time">Beginn</label>
          <input id="pt-time" type="time" class="et-field" bind:value={time} />
        </div>
        <div class="flex-[1_1_110px] flex flex-col gap-1">
          <label class="et-label" for="pt-dur">Dauer</label>
          <select id="pt-dur" class="et-field" bind:value={duration}>
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>1 h</option>
            <option value={90}>1,5 h</option>
            <option value={120}>2 h</option>
          </select>
        </div>
        <label class="flex items-center gap-2 min-h-11 cursor-pointer">
          <input type="checkbox" class="w-4 h-4" style="accent-color:var(--et-accent)" bind:checked={billable} />
          Abrechenbar
        </label>
        <div class="flex gap-2">
          <button type="submit" class="et-btn et-btn-primary" disabled={!title.trim()}>Speichern</button>
          <button type="button" class="et-btn" on:click={() => (adding = false)}>Abbrechen</button>
        </div>
      </form>
    {/if}

    {#if termine.length === 0 && !adding}
      <div class="et-row px-5 py-6 text-[13px]" style="color:var(--et-text-3)">Noch keine Termine für dieses Projekt.</div>
    {/if}
    {#each termine as termin (termin.id)}
      <div class="et-row flex items-center gap-3 min-h-14 pl-5 pr-3 py-1.5">
        <div class="flex-1 min-w-0 flex flex-col">
          <span class="font-medium truncate">{termin.title}</span>
          <span class="text-[12px]" style="color:var(--et-text-3)">{formatDateDe(termin.date)} · {termin.startTime} · {termin.durationMinutes} min</span>
        </div>
        <span class="et-badge">{TYPE_LABELS[termin.type]}</span>
        {#if termin.billable}<span class="et-badge et-badge-blue">Abrechenbar</span>{/if}
        <button class="et-btn et-btn-ghost et-btn-icon" style="width:40px;height:40px" aria-label="Termin „{termin.title}“ löschen" on:click={() => removeTermin(termin.id)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"></path></svg>
        </button>
      </div>
    {/each}
  </section>
</div>
