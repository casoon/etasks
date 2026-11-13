<!-- @module:time-tracking -->
<script lang="ts">
  import { $tasks as tasksStore } from '../../stores/taskStore';
  import { addTimeEntry, updateTimeEntry } from '../../stores/timerStore';
  import { toDateKey } from '../../domain/dateUtils';
  import type { TimeEntry } from '../../domain/types';

  /** Entry to change; `null` adds a new one on `defaultDate`. */
  export let entry: TimeEntry | null;
  export let defaultDate: string;
  export let onDone: () => void;

  const hhmm = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  let taskId = entry?.taskId ?? '';
  let date = entry ? toDateKey(new Date(entry.startAt)) : defaultDate;
  let start = entry ? hhmm(entry.startAt) : '';
  let end = entry?.endAt ? hhmm(entry.endAt) : '';
  let error = '';

  $: selectableTasks = $tasksStore
    .filter((t) => t.status !== 'done' || t.id === taskId)
    .sort((a, b) => a.title.localeCompare(b.title, 'de'));

  function save() {
    if (!taskId) { error = 'Bitte eine Aufgabe wählen.'; return; }
    if (!date || !start || !end) { error = 'Bitte Datum, Start und Ende angeben.'; return; }
    const startAt = new Date(`${date}T${start}`);
    const endAt = new Date(`${date}T${end}`);
    if (!(endAt.getTime() > startAt.getTime())) { error = 'Das Ende muss nach dem Start liegen.'; return; }
    if (entry) updateTimeEntry(entry.id, taskId, startAt.toISOString(), endAt.toISOString());
    else addTimeEntry(taskId, startAt.toISOString(), endAt.toISOString());
    onDone();
  }
</script>

<form
  class="et-row flex flex-wrap items-end gap-x-3 gap-y-2 px-5 py-3"
  style="background:var(--et-accent-soft)"
  aria-label={entry ? 'Eintrag bearbeiten' : 'Eintrag nachtragen'}
  on:submit|preventDefault={save}
>
  <div class="flex-[2_1_220px] min-w-[200px] flex flex-col gap-1">
    <label class="et-label" for="te-task">Aufgabe</label>
    <select id="te-task" class="et-field" bind:value={taskId}>
      <option value="">Aufgabe wählen</option>
      {#each selectableTasks as t (t.id)}<option value={t.id}>{t.title}</option>{/each}
    </select>
  </div>
  <div class="flex-[1_1_150px] flex flex-col gap-1">
    <label class="et-label" for="te-date">Datum</label>
    <input id="te-date" type="date" class="et-field" bind:value={date} />
  </div>
  <div class="flex-[1_1_110px] flex flex-col gap-1">
    <label class="et-label" for="te-start">Von</label>
    <input id="te-start" type="time" class="et-field" bind:value={start} />
  </div>
  <div class="flex-[1_1_110px] flex flex-col gap-1">
    <label class="et-label" for="te-end">Bis</label>
    <input id="te-end" type="time" class="et-field" bind:value={end} />
  </div>
  <div class="flex gap-2">
    <button type="submit" class="et-btn et-btn-primary">Speichern</button>
    <button type="button" class="et-btn" on:click={onDone}>Abbrechen</button>
  </div>
  {#if error}
    <p class="basis-full text-[13px] font-semibold" style="color:var(--et-danger)" role="alert">{error}</p>
  {/if}
</form>
