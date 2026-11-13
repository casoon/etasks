<!-- @module:calendar -->
<script lang="ts">
  import { $todayBlocks as todayBlocksStore, moveBlock, dropTaskOnCalendar, removeBlock } from '../../stores/calendarStore';
  import { $tasks as tasksStore, updateTask } from '../../stores/taskStore';
  import { $termine as termineStore, addTermin, updateTermin, removeTermin } from '../../stores/terminStore';
  import { $projects as projectsStore } from '../../stores/projectStore';
  import CalendarBlockComponent from '../widgets/CalendarBlock.svelte';
  import { getBlockTop, getBlockHeight, snapToGrid, dayHourRange } from '../../domain/calendarService';
  import { today } from '../../domain/dateUtils';
  import type { CalendarBlock, Task, Termin, TerminType } from '../../domain/types';
  import { getTaskDragData, hasTaskDragData } from '../../lib/taskDrag';

  export let planningMode = false;
  export let activeDate: string = today();
  /** Auto-plan suggestions, drawn dashed until confirmed. */
  export let proposals: { taskId: string; title: string; start: string; minutes: number }[] = [];

  const HOUR_HEIGHT = 64;
  // 06–20 Uhr, wird für Termine außerhalb davon erweitert (siehe termine unten)
  let DAY_START = 6;
  let DAY_END = 20;
  $: ({ start: DAY_START, end: DAY_END } = dayHourRange(6, 20, termine));
  $: HOURS = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
  $: GRID_HEIGHT = (DAY_END - DAY_START) * HOUR_HEIGHT;

  $: blocks = $todayBlocksStore;

  let gridEl: HTMLDivElement;
  let scrollEl: HTMLDivElement;

  function scheduleTask(task: { id: string; plannedDate?: string | null }, start: Date): void {
    const scheduledStart = start.toISOString();
    updateTask(task.id, {
      plannedDate: activeDate,
      scheduledStart,
      scheduledEnd: null,
    });
    dropTaskOnCalendar({ ...task, plannedDate: activeDate } as Task, start);
  }

  function getTimeFromY(y: number): Date {
    const date = new Date(`${activeDate}T00:00:00`);
    const totalMinutes = (y / HOUR_HEIGHT) * 60 + DAY_START * 60;
    date.setHours(Math.floor(totalMinutes / 60), Math.round(totalMinutes % 60), 0, 0);
    return snapToGrid(date);
  }

  function handleMoveStart(block: CalendarBlock, e: PointerEvent) {
    if (!gridEl) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const gridRect = gridEl.getBoundingClientRect();
    const blockTop = getBlockTop(new Date(block.start), DAY_START, HOUR_HEIGHT);
    const offsetY = e.clientY - gridRect.top - blockTop;

    function onMove(ev: PointerEvent) {
      const rawY = ev.clientY - gridRect.top - offsetY;
      const clampedY = Math.max(0, Math.min(rawY, (DAY_END - DAY_START) * HOUR_HEIGHT));
      const el = gridEl?.querySelector(`[data-block-id="${block.id}"]`) as HTMLElement | null;
      if (el) el.style.top = `${clampedY}px`;
    }

    function onUp(ev: PointerEvent) {
      const rawY = ev.clientY - gridRect.top - offsetY;
      const clampedY = Math.max(0, Math.min(rawY, (DAY_END - DAY_START) * HOUR_HEIGHT));
      const nextStart = getTimeFromY(clampedY);
      moveBlock(block.id, nextStart);
      if (block.taskId) {
        updateTask(block.taskId, {
          plannedDate: activeDate,
          scheduledStart: nextStart.toISOString(),
          scheduledEnd: null,
        });
      }
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  const now = new Date();
  const nowMinutes = (now.getHours() - DAY_START) * 60 + now.getMinutes();
  const nowTop = (nowMinutes / 60) * HOUR_HEIGHT;
  $: showNowLine = now.getHours() >= DAY_START && now.getHours() < DAY_END;

  // ── Task-Drop auf Kalender ─────────────────────────────────────────────────
  let ghostY: number | null = null;
  let ghostLabel = '';
  let hoverY: number | null = null;
  let hoverLabel = '';
  let slotDropIso = '';
  let slotDropTop: number | null = null;

  function getYFromEvent(e: DragEvent): number {
    const rect = gridEl.getBoundingClientRect();
    return Math.max(0, Math.min(e.clientY - rect.top, (DAY_END - DAY_START) * HOUR_HEIGHT));
  }

  function onGridDragOver(e: DragEvent) {
    if (!hasTaskDragData(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    if (!gridEl) return;
    const y = getYFromEvent(e);
    ghostY = y;
    const t = getTimeFromY(y);
    ghostLabel = t.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    slotDropIso = t.toISOString();
    slotDropTop = getBlockTop(t, DAY_START, HOUR_HEIGHT);
  }

  function onGridDrop(e: DragEvent) {
    ghostY = null;
    hoverY = null;
    hoverLabel = '';
    slotDropIso = '';
    slotDropTop = null;
    const taskId = getTaskDragData(e.dataTransfer);
    if (!taskId) return;
    e.preventDefault();
    const task = $tasksStore.find(t => t.id === taskId);
    if (!task) return;
    const start = getTimeFromY(getYFromEvent(e));
    scheduleTask(task, start);
  }

  function onGridDragLeave(e: DragEvent) {
    // Only clear ghost if leaving the scroll container entirely
    if (scrollEl && !scrollEl.contains(e.relatedTarget as Node)) {
      ghostY = null;
      slotDropIso = '';
      slotDropTop = null;
    }
  }

  function onGridMouseMove(e: MouseEvent) {
    if (!planningMode || !gridEl) return;
    const rect = gridEl.getBoundingClientRect();
    const y = Math.max(0, Math.min(e.clientY - rect.top, (DAY_END - DAY_START) * HOUR_HEIGHT));
    hoverY = y;
    const t = getTimeFromY(y);
    hoverLabel = t.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }

  function onGridMouseLeave() {
    hoverY = null;
    hoverLabel = '';
  }

  function onSlotDragOver(e: DragEvent, iso: string) {
    if (!hasTaskDragData(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    const start = snapToGrid(new Date(iso));
    const top = getBlockTop(start, DAY_START, HOUR_HEIGHT);
    ghostY = top;
    ghostLabel = start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    slotDropIso = start.toISOString();
    slotDropTop = top;
  }

  function onSlotDrop(e: DragEvent, iso: string) {
    if (!hasTaskDragData(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    const taskId = getTaskDragData(e.dataTransfer);
    const task = $tasksStore.find(t => t.id === taskId);
    ghostY = null;
    slotDropIso = '';
    slotDropTop = null;
    hoverY = null;
    hoverLabel = '';
    if (!task) return;
    scheduleTask(task, snapToGrid(new Date(iso)));
  }

  function handleBlockRemove(block: CalendarBlock) {
    removeBlock(block.id);
    if (block.taskId) {
      updateTask(block.taskId, {
        scheduledStart: null,
        scheduledEnd: null,
      });
    }
  }

  // ── Termine ────────────────────────────────────────────────────────────────
  $: termine = $termineStore.filter(t => t.date === activeDate);
  $: projects = $projectsStore;

  const TERMIN_TYPE_LABELS: Record<TerminType, string> = { video: 'Video', phone: 'Telefon', onsite: 'Vor Ort' };

  function getTerminTop(startTime: string, dayStart: number): number {
    const [h, m] = startTime.split(':').map(Number);
    return ((h - dayStart) + m / 60) * HOUR_HEIGHT;
  }
  function getTerminHeight(durationMinutes: number): number {
    return (durationMinutes / 60) * HOUR_HEIGHT;
  }

  let addingTermin = false;
  let editingTerminId: string | null = null;
  let newTerminTitle = '';
  let newTerminDate = activeDate;
  let newTerminTime = '09:00';
  let newTerminDuration = 60;
  let newTerminType: TerminType = 'video';
  let newTerminProjectId = '';
  let newTerminBillable = false;
  const TERMIN_DURATIONS = [15, 30, 45, 60, 90, 120];

  function resetTerminForm() {
    editingTerminId = null;
    newTerminTitle = '';
    newTerminDate = activeDate;
    newTerminTime = '09:00';
    newTerminDuration = 60;
    newTerminType = 'video';
    newTerminProjectId = '';
    newTerminBillable = false;
    addingTermin = false;
  }

  function startEditTermin(termin: Termin) {
    editingTerminId = termin.id;
    newTerminTitle = termin.title;
    newTerminDate = termin.date;
    newTerminTime = termin.startTime;
    newTerminDuration = termin.durationMinutes;
    newTerminType = termin.type;
    newTerminProjectId = termin.projectId ?? '';
    newTerminBillable = termin.billable;
    addingTermin = true;
  }

  function handleAddTermin(e: Event) {
    e.preventDefault();
    if (!newTerminTitle.trim() || !newTerminDate || !newTerminTime) return;
    const fields = {
      date: newTerminDate,
      startTime: newTerminTime,
      durationMinutes: newTerminDuration,
      type: newTerminType,
      title: newTerminTitle.trim(),
      projectId: newTerminProjectId || undefined,
      billable: newTerminBillable,
    };
    if (editingTerminId) updateTermin(editingTerminId, fields);
    else addTermin(fields);
    resetTerminForm();
  }
</script>

<div class="flex flex-col overflow-hidden min-w-0 h-full">
  <div class="flex items-center gap-2.5 flex-shrink-0 mb-3">
    <h2 class="text-[15px] font-semibold flex-1">Kalender</h2>
    {#if planningMode}
      <button
        class="h-9 px-3 rounded-lg border border-[var(--et-border-strong)] bg-surface text-[13px] font-medium hover:bg-[var(--et-surface-sunken)] transition-colors flex-shrink-0"
        style="color:var(--et-text-2)"
        aria-expanded={addingTermin}
        on:click={() => { if (addingTermin) resetTerminForm(); else { newTerminDate = activeDate; addingTermin = true; } }}
      >+ Termin</button>
    {/if}
  </div>

  {#if addingTermin}
    <form
      class="mb-3 p-3 border rounded-xl flex flex-col gap-2 flex-shrink-0"
      style="border-color:var(--et-accent);background:var(--et-surface-sunken)"
      on:submit={handleAddTermin}
    >
      <label class="flex flex-col gap-1 text-[12px] font-semibold" style="color:var(--et-text-2)">
        Titel des Termins
        <!-- svelte-ignore a11y-autofocus -->
        <input
          class="w-full h-11 px-3 border border-[var(--et-border-strong)] rounded-[9px] text-[14px] font-normal bg-surface"
          bind:value={newTerminTitle}
          autofocus
        />
      </label>
      <div class="grid grid-cols-2 gap-2">
        <label class="flex flex-col gap-1 text-[12px] font-semibold" style="color:var(--et-text-2)">Art
          <select class="h-11 border border-[var(--et-border-strong)] rounded-[9px] px-2 text-[14px] font-normal bg-surface" bind:value={newTerminType}>
            <option value="video">Video</option>
            <option value="phone">Telefon</option>
            <option value="onsite">Vor Ort</option>
          </select>
        </label>
        <label class="flex flex-col gap-1 text-[12px] font-semibold" style="color:var(--et-text-2)">Dauer
          <select class="h-11 border border-[var(--et-border-strong)] rounded-[9px] px-2 text-[14px] font-normal bg-surface" bind:value={newTerminDuration}>
            {#if !TERMIN_DURATIONS.includes(newTerminDuration)}
              <option value={newTerminDuration}>{newTerminDuration} min</option>
            {/if}
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>1 h</option>
            <option value={90}>1,5 h</option>
            <option value={120}>2 h</option>
          </select>
        </label>
        <label class="flex flex-col gap-1 text-[12px] font-semibold" style="color:var(--et-text-2)">Datum
          <input type="date" class="h-11 border border-[var(--et-border-strong)] rounded-[9px] px-2 text-[14px] font-normal bg-surface" bind:value={newTerminDate} />
        </label>
        <label class="flex flex-col gap-1 text-[12px] font-semibold" style="color:var(--et-text-2)">Beginn
          <input type="time" class="h-11 border border-[var(--et-border-strong)] rounded-[9px] px-2 text-[14px] font-normal bg-surface" bind:value={newTerminTime} />
        </label>
      </div>
      {#if projects.filter(p => p.status === 'active').length > 0}
        <label class="flex flex-col gap-1 text-[12px] font-semibold" style="color:var(--et-text-2)">Projekt
          <select class="h-11 border border-[var(--et-border-strong)] rounded-[9px] px-2 text-[14px] font-normal bg-surface" bind:value={newTerminProjectId}>
            <option value="">Kein Projekt</option>
            {#each projects.filter(p => p.status === 'active') as p (p.id)}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>
        </label>
      {/if}
      <label class="flex items-center gap-2 min-h-[44px] text-[14px] cursor-pointer">
        <input type="checkbox" bind:checked={newTerminBillable} class="w-4 h-4 accent-accent" />
        Abrechenbar
      </label>
      <div class="flex gap-2">
        <button type="submit" class="flex-1 h-11 rounded-[10px] text-white text-[14px] font-semibold" style="background:var(--et-accent)">{editingTerminId ? 'Speichern' : 'Anlegen'}</button>
        <button type="button" class="h-11 px-4 rounded-[10px] text-[14px] font-medium hover:bg-surface" style="color:var(--et-text-2)" on:click={resetTerminForm}>Abbrechen</button>
      </div>
    </form>
  {/if}

  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="flex-1 overflow-y-auto"
    bind:this={scrollEl}
    on:dragover={onGridDragOver}
    on:drop={onGridDrop}
    on:dragleave={onGridDragLeave}
    on:mousemove={onGridMouseMove}
    on:mouseleave={onGridMouseLeave}
  >
    <div
      class="relative w-full min-h-full rounded-xl {ghostY !== null ? 'ring-2 ring-accent/30 bg-accent-subtle/10' : ''}"
      bind:this={gridEl}
      style="height:{GRID_HEIGHT}px; min-height:{GRID_HEIGHT}px"
    >
      {#each HOURS as hour (hour)}
        <div class="relative flex items-start border-t border-border-subtle" style="height:{HOUR_HEIGHT}px">
          <span class="text-[12px] w-10 pt-1 flex-shrink-0 select-none" style="color:var(--et-text-3)">{String(hour).padStart(2, '0')}:00</span>
          <div class="flex-1 h-px bg-border-subtle mt-[10px]" />
          {#each [0, 15, 30, 45] as min (min)}
            {@const d = new Date()}
            {@const _ = d.setHours(hour, min, 0, 0)}
            <div
              class="absolute left-10 right-0 z-[1] transition-colors {slotDropIso === snapToGrid(new Date(d)).toISOString() ? 'bg-accent/10' : ''}"
              data-time-slot={d.toISOString()}
              style="top:{(min / 60) * HOUR_HEIGHT}px; height:{HOUR_HEIGHT / 4}px"
              on:dragover={(e) => onSlotDragOver(e, d.toISOString())}
              on:drop={(e) => onSlotDrop(e, d.toISOString())}
            />
          {/each}
        </div>
      {/each}

      {#if planningMode && slotDropTop !== null}
        <div
          class="absolute left-10 right-0 z-[2] rounded-md border border-dashed border-accent/50 bg-accent/8 pointer-events-none"
          style="top:{slotDropTop}px; height:{HOUR_HEIGHT / 4}px"
        >
          <div class="absolute right-2 top-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
            Ablegen um {ghostLabel}
          </div>
        </div>
      {/if}

      {#if showNowLine && !planningMode}
        <div class="absolute left-10 right-0 h-[2px] bg-red-500 z-[3] pointer-events-none" style="top:{nowTop}px">
          <div class="absolute -left-1 -top-1 w-[10px] h-[10px] rounded-full bg-red-500" />
        </div>
      {/if}

      {#if ghostY !== null}
        <div
          class="absolute left-10 right-0 z-[10] pointer-events-none flex items-center gap-1"
          style="top:{ghostY}px"
        >
          <div class="h-[2px] flex-1 bg-accent/60 rounded" />
          <span class="text-[10px] text-accent font-semibold bg-surface px-1 rounded">{ghostLabel}</span>
        </div>
      {/if}

      {#if planningMode && hoverY !== null && ghostY === null}
        <div
          class="absolute left-10 right-0 z-[4] pointer-events-none flex items-center gap-1 opacity-70"
          style="top:{hoverY}px"
        >
          <div class="h-[1px] flex-1 bg-accent/35 rounded" />
          <span class="text-[10px] text-accent font-medium bg-surface/90 px-1 rounded border border-accent/10">{hoverLabel}</span>
        </div>
      {/if}

      {#each proposals as pr (pr.taskId)}
        {@const pStart = new Date(pr.start)}
        <div
          class="absolute left-10 right-1 z-[3] rounded-[7px] px-2 py-0.5 overflow-hidden box-border text-[12px] font-semibold pointer-events-none"
          style="top:{getBlockTop(pStart, DAY_START, HOUR_HEIGHT)}px; height:{Math.max(getBlockHeight(pStart, new Date(pStart.getTime() + pr.minutes * 60000), HOUR_HEIGHT), 22)}px; background:var(--et-surface); border:1.5px dashed var(--et-warning-text); color:var(--et-warning-text)"
        >Vorschlag · {pr.title}</div>
      {/each}

      {#each blocks as block (block.id)}
        {@const start = new Date(block.start)}
        {@const end = new Date(block.end)}
        <CalendarBlockComponent
          {block}
          top={getBlockTop(start, DAY_START, HOUR_HEIGHT)}
          height={getBlockHeight(start, end, HOUR_HEIGHT)}
          onMoveStart={handleMoveStart}
          onRemove={handleBlockRemove}
        />
      {/each}

      {#each termine as termin (termin.id)}
        {@const top = getTerminTop(termin.startTime, DAY_START)}
        {@const height = Math.max(getTerminHeight(termin.durationMinutes), 20)}
        {@const proj = termin.projectId ? projects.find(p => p.id === termin.projectId) : null}
        <div
          class="absolute left-10 right-1 z-[5] rounded-[7px] px-2 py-1 overflow-hidden group box-border"
          style="top:{top}px; height:{height}px; background:var(--et-appointment-soft); border:1px solid var(--et-appointment); color:var(--et-appointment-text)"
        >
          <div class="flex items-start justify-between gap-1 h-full">
            <div class="flex-1 min-w-0">
              <p class="text-[12px] font-semibold leading-tight truncate">Termin · {termin.title}</p>
              {#if height > 28}
                <p class="text-[11px] leading-tight">{termin.startTime} · {TERMIN_TYPE_LABELS[termin.type]}{termin.billable ? ' · abrechenbar' : ''}</p>
              {/if}
            </div>
            <button
              class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 w-6 h-6 -my-0.5 flex items-center justify-center rounded flex-shrink-0 hover:bg-white/60 transition-opacity"
              on:click={() => startEditTermin(termin)}
              aria-label="Termin {termin.title} bearbeiten"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"></path></svg>
            </button>
            <button
              class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 w-6 h-6 -my-0.5 flex items-center justify-center rounded flex-shrink-0 hover:bg-white/60 transition-opacity"
              on:click={() => removeTermin(termin.id)}
              aria-label="Termin {termin.title} löschen"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>
            </button>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>
