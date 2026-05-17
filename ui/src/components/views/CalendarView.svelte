<!-- @module:calendar -->
<script lang="ts">
  import { $todayBlocks as todayBlocksStore, moveBlock, dropTaskOnCalendar, removeBlock } from '../../stores/calendarStore';
  import { $tasks as tasksStore, updateTask } from '../../stores/taskStore';
  import { $termine as termineStore, addTermin, removeTermin } from '../../stores/terminStore';
  import { $projects as projectsStore } from '../../stores/projectStore';
  import CalendarBlockComponent from '../widgets/CalendarBlock.svelte';
  import { getBlockTop, getBlockHeight, snapToGrid } from '../../domain/calendarService';
  import type { CalendarBlock, Task, TerminType } from '../../domain/types';
  import { getTaskDragData, hasTaskDragData } from '../../lib/taskDrag';

  export let planningMode = false;
  export let activeDate: string = new Date().toISOString().slice(0, 10);

  const DAY_START = 6;
  const DAY_END = 20;
  const HOUR_HEIGHT = 64;
  const HOURS = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
  const GRID_HEIGHT = (DAY_END - DAY_START) * HOUR_HEIGHT;

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
    const date = new Date();
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

  const TERMIN_TYPE_ICONS: Record<TerminType, string> = { video: '📹', phone: '📞', onsite: '🏢' };
  const TERMIN_TYPE_LABELS: Record<TerminType, string> = { video: 'Video', phone: 'Telefon', onsite: 'Vor Ort' };

  function getTerminTop(startTime: string): number {
    const [h, m] = startTime.split(':').map(Number);
    return ((h - DAY_START) + m / 60) * HOUR_HEIGHT;
  }
  function getTerminHeight(durationMinutes: number): number {
    return (durationMinutes / 60) * HOUR_HEIGHT;
  }

  let addingTermin = false;
  let newTerminTitle = '';
  let newTerminTime = '09:00';
  let newTerminDuration = 60;
  let newTerminType: TerminType = 'video';
  let newTerminProjectId = '';
  let newTerminBillable = false;

  function handleAddTermin(e: Event) {
    e.preventDefault();
    if (!newTerminTitle.trim()) return;
    addTermin({
      date: activeDate,
      startTime: newTerminTime,
      durationMinutes: newTerminDuration,
      type: newTerminType,
      title: newTerminTitle.trim(),
      projectId: newTerminProjectId || undefined,
      billable: newTerminBillable,
    });
    newTerminTitle = '';
    newTerminTime = '09:00';
    newTerminDuration = 60;
    newTerminType = 'video';
    newTerminProjectId = '';
    newTerminBillable = false;
    addingTermin = false;
  }
</script>

<div class="flex flex-col overflow-hidden min-w-0">
  <div class="flex items-center gap-2 px-4 pt-4 pb-3 flex-shrink-0">
    <h2 class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted whitespace-nowrap overflow-hidden text-ellipsis flex-1">Kalender</h2>
    {#if planningMode}
      <span class="text-[10px] text-muted hidden lg:inline">Tasks aus „Heute“ hier hineinziehen oder Slots direkt setzen</span>
      <button
        class="text-[11px] px-2 py-0.5 rounded-md border border-dashed border-border text-muted hover:border-accent hover:text-accent transition-colors flex-shrink-0"
        on:click={() => addingTermin = !addingTermin}
        title="Termin hinzufügen"
      >+ Termin</button>
    {/if}
  </div>

  {#if addingTermin}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <form
      class="mx-3 mb-2 p-3 bg-surface border border-accent/30 rounded-lg flex flex-col gap-2 flex-shrink-0"
      on:submit={handleAddTermin}
    >
      <!-- svelte-ignore a11y-autofocus -->
      <input
        class="w-full px-2 py-1.5 border border-border rounded-lg text-[12px] outline-none bg-bg focus:border-accent"
        bind:value={newTerminTitle}
        placeholder="Titel des Termins…"
        autofocus
      />
      <div class="flex gap-2 flex-wrap">
        <select class="border border-border rounded-md px-1.5 py-1 text-[11px] bg-bg outline-none" bind:value={newTerminType}>
          <option value="video">📹 Video</option>
          <option value="phone">📞 Telefon</option>
          <option value="onsite">🏢 Vor Ort</option>
        </select>
        <input type="time" class="border border-border rounded-md px-1.5 py-1 text-[11px] bg-bg outline-none" bind:value={newTerminTime} />
        <select class="border border-border rounded-md px-1.5 py-1 text-[11px] bg-bg outline-none" bind:value={newTerminDuration}>
          <option value={15}>15 min</option>
          <option value={30}>30 min</option>
          <option value={45}>45 min</option>
          <option value={60}>1 h</option>
          <option value={90}>1,5 h</option>
          <option value={120}>2 h</option>
        </select>
      </div>
      {#if projects.filter(p => p.status === 'active').length > 0}
        <select class="border border-border rounded-md px-1.5 py-1 text-[11px] bg-bg outline-none" bind:value={newTerminProjectId}>
          <option value="">Kein Projekt</option>
          {#each projects.filter(p => p.status === 'active') as p (p.id)}
            <option value={p.id}>{p.name}</option>
          {/each}
        </select>
      {/if}
      <label class="flex items-center gap-1.5 text-[11px] text-muted cursor-pointer">
        <input type="checkbox" bind:checked={newTerminBillable} class="accent-accent" />
        Abrechenbar
      </label>
      <div class="flex gap-2">
        <button type="submit" class="flex-1 px-3 py-1.5 bg-accent text-white rounded-lg text-[12px] font-medium hover:opacity-90 transition-opacity">Speichern</button>
        <button type="button" class="px-3 py-1.5 text-secondary rounded-lg text-[12px] hover:bg-bg transition-colors" on:click={() => addingTermin = false}>Abbrechen</button>
      </div>
    </form>
  {/if}

  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="flex-1 overflow-y-auto px-3 pb-6"
    bind:this={scrollEl}
    on:dragover={onGridDragOver}
    on:drop={onGridDrop}
    on:dragleave={onGridDragLeave}
    on:mousemove={onGridMouseMove}
    on:mouseleave={onGridMouseLeave}
  >
    {#if planningMode}
      <div class="mb-3 rounded-xl border border-dashed border-accent/30 bg-accent-subtle/25 px-3 py-2 text-[11px] text-secondary">
        Freie Tasks aus der Mitte hier auf eine Uhrzeit ziehen. Beim Loslassen wird sofort ein echter Zeitslot angelegt.
      </div>
    {/if}
    <div
      class="relative w-full min-h-full rounded-xl {ghostY !== null ? 'ring-2 ring-accent/30 bg-accent-subtle/10' : ''}"
      bind:this={gridEl}
      style="height:{GRID_HEIGHT}px; min-height:{GRID_HEIGHT}px"
    >
      {#each HOURS as hour (hour)}
        <div class="relative flex items-start border-t border-border-subtle" style="height:{HOUR_HEIGHT}px">
          <span class="text-[11px] text-muted w-10 pt-1 flex-shrink-0 select-none">{String(hour).padStart(2, '0')}:00</span>
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
        {@const top = getTerminTop(termin.startTime)}
        {@const height = Math.max(getTerminHeight(termin.durationMinutes), 20)}
        {@const proj = termin.projectId ? projects.find(p => p.id === termin.projectId) : null}
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
          class="absolute left-10 right-1 z-[5] rounded-md px-2 py-1 overflow-hidden group"
          style="top:{top}px; height:{height}px; background:{proj ? proj.color + '33' : '#6366f133'}; border-left: 3px solid {proj ? proj.color : '#6366f1'}"
        >
          <div class="flex items-start justify-between gap-1 h-full">
            <div class="flex-1 min-w-0">
              <p class="text-[11px] font-semibold leading-tight truncate" style="color:{proj ? proj.color : '#6366f1'}">{TERMIN_TYPE_ICONS[termin.type]} {termin.title}</p>
              {#if height > 28}
                <p class="text-[10px] opacity-70 leading-tight">{TERMIN_TYPE_LABELS[termin.type]}{termin.billable ? ' · €' : ''}</p>
              {/if}
            </div>
            <button
              class="opacity-0 group-hover:opacity-100 text-[11px] leading-none text-muted hover:text-red-500 transition-all flex-shrink-0"
              on:click={() => removeTermin(termin.id)}
              title="Termin löschen"
            >×</button>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>
