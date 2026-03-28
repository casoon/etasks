<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    $tasks as tasksStore,
    $activeDate as activeDateStore,
    addTask, updateTask, reorderTasks,
  } from '../stores/taskStore';
  import { $projects as projectsStore } from '../stores/projectStore';
  import { $dailyIntention as intentionStore, $mitTaskIds as mitStore, setIntention, toggleMit } from '../stores/planningStore';
  import { formatDate } from '../domain/dateUtils';
  import CalendarView from './CalendarView.svelte';
  import { importICSFile } from '../lib/icsParser';
  import { upsertBlock } from '../lib/db';
  import { initBlocks } from '../stores/calendarStore';
  import type { Task } from '../domain/types';

  let tasks: Task[] = tasksStore.get();
  let activeDate: string = activeDateStore.get();
  let intention: string = intentionStore.get();
  let mitIds: string[] = mitStore.get();

  onDestroy(tasksStore.subscribe(v => { tasks = [...v]; }));
  onDestroy(activeDateStore.subscribe(v => { activeDate = v; }));
  onDestroy(intentionStore.subscribe(v => { intention = v; }));
  onDestroy(mitStore.subscribe(v => { mitIds = [...v]; }));

  $: projects = $projectsStore;
  $: activeProjects = projects.filter(p => p.status === 'active');

  $: todayTasks = tasks
    .filter(t => t.plannedDate === activeDate && t.status === 'todo')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  $: poolTasks = tasks
    .filter(t => t.status === 'todo' && t.plannedDate !== activeDate)
    .sort((a, b) => (b.plannedDate ?? '').localeCompare(a.plannedDate ?? ''));

  $: hasAnyTodoTasks = tasks.some(t => t.status === 'todo');

  $: doneTodayCount = tasks.filter(t => t.plannedDate === activeDate && t.status === 'done').length;
  $: totalMinutes = todayTasks.reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0);
  $: totalLabel = totalMinutes >= 60
    ? `${Math.floor(totalMinutes / 60)}h${totalMinutes % 60 > 0 ? ' ' + totalMinutes % 60 + 'min' : ''}`
    : totalMinutes > 0 ? `${totalMinutes} min` : '';

  function projectColor(task: Task): string | null {
    if (!task.projectId) return null;
    return projects.find(p => p.id === task.projectId)?.color ?? null;
  }

  // ── Task creation ──────────────────────────────────────────────────────────
  let newTitle = '';
  let newDuration = 30;
  let newProjectId = '';
  let addToToday = true;
  let inputEl: HTMLInputElement;

  function handleAdd(e: Event) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const task = addTask(newTitle.trim(), newDuration, [], newProjectId || undefined);
    if (!addToToday) updateTask(task.id, { plannedDate: null });
    newTitle = '';
    newDuration = 30;
    inputEl?.focus();
  }

  function assignToToday(task: Task) { updateTask(task.id, { plannedDate: activeDate }); }
  function removeFromToday(task: Task) { updateTask(task.id, { plannedDate: null }); }

  // ── Duration inline edit ──────────────────────────────────────────────────
  let editDurationId: string | null = null;
  function commitDuration(task: Task, val: string) {
    const n = parseInt(val, 10);
    if (!isNaN(n) && n > 0) updateTask(task.id, { estimatedMinutes: n });
    editDurationId = null;
  }

  // ── Drag-to-reorder ───────────────────────────────────────────────────────
  let draggingId: string | null = null;
  let dragOverId: string | null = null;

  function onDragStart(e: DragEvent, id: string) {
    draggingId = id;
    e.dataTransfer!.effectAllowed = 'move';
  }
  function onDragOver(e: DragEvent, id: string) {
    e.preventDefault();
    dragOverId = id;
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    if (!draggingId || !dragOverId || draggingId === dragOverId) {
      draggingId = null; dragOverId = null; return;
    }
    const ids = todayTasks.map(t => t.id);
    const from = ids.indexOf(draggingId);
    const to = ids.indexOf(dragOverId);
    if (from === -1 || to === -1) { draggingId = null; dragOverId = null; return; }
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, draggingId);
    reorderTasks(next);
    draggingId = null; dragOverId = null;
  }
  function onDragEnd() { draggingId = null; dragOverId = null; }

  function startDay() {
    (document.querySelector('[data-nav="today"]') as HTMLElement)?.click();
  }

  let icsImporting = false;
  async function handleICSImport() {
    icsImporting = true;
    try {
      const blocks = await importICSFile();
      for (const block of blocks) {
        upsertBlock(block);
      }
      if (blocks.length > 0) initBlocks();
    } finally {
      icsImporting = false;
    }
  }
</script>

<!--
  Tagesplanung = "Werkzeug", nicht "Seite"
  Dichte Panels, sichtbare Controls, bg-bg Untergrund
-->
<div class="flex flex-col h-full overflow-hidden bg-bg">

  <!-- Tool-Header: kompakt, funktional -->
  <div class="flex items-center gap-3 px-4 py-0 border-b border-border bg-surface flex-shrink-0" style="min-height:44px">
    <div class="w-1 h-5 rounded-full bg-accent flex-shrink-0"></div>
    <span class="text-[13px] font-bold text-primary whitespace-nowrap">Plane deinen Tag</span>
    <span class="text-[11px] text-muted hidden sm:inline whitespace-nowrap">· {formatDate(activeDate)}</span>
    <div class="w-px h-4 bg-border flex-shrink-0 mx-1"></div>
    <input
      class="flex-1 text-[12px] text-secondary bg-transparent outline-none placeholder:text-muted/40 min-w-0"
      placeholder="Intention für heute…"
      value={intention}
      on:input={e => setIntention(e.currentTarget.value)}
    />
    <div class="flex items-center gap-2 flex-shrink-0">
      {#if doneTodayCount > 0}
        <span class="text-[11px] text-muted">{doneTodayCount} erledigt</span>
      {/if}
      <button
        on:click={handleICSImport}
        disabled={icsImporting}
        class="px-2.5 py-1 border border-border rounded-md text-[11px] text-secondary hover:bg-bg transition-colors disabled:opacity-50"
        title="Kalendertermine aus ICS-Datei importieren"
      >{icsImporting ? '…' : '📅 ICS'}</button>
      <button
        on:click={startDay}
        class="px-3 py-1 bg-accent text-white rounded-md text-[12px] font-semibold hover:bg-accent/90 transition-colors"
      >Tag starten →</button>
    </div>
  </div>

  <!-- 3 columns on bg-bg -->
  <div class="flex-1 grid overflow-hidden min-w-0 gap-px bg-border" style="grid-template-columns: 260px 1fr 280px">

    <!-- ── Pool ── -->
    <div class="flex flex-col overflow-hidden bg-surface">
      <!-- Pool header + Task Creation -->
      <div class="border-b border-border flex-shrink-0">
        <!-- Header -->
        <div class="flex items-center justify-between px-3 pt-2.5 pb-1">
          <span class="text-[10px] font-bold uppercase tracking-[0.09em] text-muted">
            Verfügbare Aufgaben
            {#if poolTasks.length > 0}
              <span class="font-normal normal-case tracking-normal text-secondary ml-1">{poolTasks.length}</span>
            {/if}
          </span>
        </div>

        <!-- Task Creation: prominenter Flow -->
        <form on:submit={handleAdd} class="px-3 pb-3 flex flex-col gap-2">
          <!-- svelte-ignore a11y-autofocus -->
          <input
            bind:this={inputEl}
            bind:value={newTitle}
            class="w-full px-3 py-2 border-2 border-border rounded-lg text-[13px] bg-surface outline-none focus:border-accent placeholder:text-muted/50 transition-colors"
            placeholder="Neue Aufgabe erstellen…"
          />
          <div class="flex items-center gap-1.5">
            <select bind:value={newDuration} class="border border-border rounded-md px-2 py-1.5 text-[12px] bg-surface outline-none">
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>1 h</option>
              <option value={90}>1,5 h</option>
              <option value={120}>2 h</option>
            </select>
            {#if activeProjects.length > 0}
              <select bind:value={newProjectId} class="border border-border rounded-md px-2 py-1.5 text-[12px] bg-surface outline-none flex-1 min-w-0">
                <option value="">Kein Projekt</option>
                {#each activeProjects as p (p.id)}
                  <option value={p.id}>{p.name}</option>
                {/each}
              </select>
            {/if}
            <label class="flex items-center gap-1 text-[11px] text-muted cursor-pointer whitespace-nowrap ml-auto">
              <input type="checkbox" bind:checked={addToToday} class="w-3 h-3" />
              Heute
            </label>
            <button
              type="submit"
              class="px-3 py-1.5 bg-accent text-white rounded-md text-[12px] font-semibold hover:bg-accent/90 transition-colors whitespace-nowrap"
            >Hinzufügen</button>
          </div>
        </form>
      </div>

      <!-- Pool list -->
      <div class="flex-1 overflow-y-auto">
        {#each poolTasks as task (task.id)}
          {@const col = projectColor(task)}
          <div class="flex items-center gap-2 px-3 py-2 border-b border-border/60 hover:bg-bg/80 group">
            {#if col}
              <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background:{col}" />
            {/if}
            <span class="text-[12px] text-secondary flex-1 min-w-0 truncate">{task.title}</span>
            <span class="text-[10px] text-muted flex-shrink-0">{(task.estimatedMinutes ?? 0) < 60 ? (task.estimatedMinutes ?? 0) + 'min' : ((task.estimatedMinutes ?? 0) / 60) + 'h'}</span>
            <button
              on:click={() => assignToToday(task)}
              class="text-[11px] text-accent flex-shrink-0 whitespace-nowrap hover:underline font-medium"
            >→</button>
          </div>
        {:else}
          {#if hasAnyTodoTasks}
            <p class="text-[11px] text-muted px-3 py-3">Alle Aufgaben sind bereits für heute eingeplant.</p>
          {:else}
            <div class="px-3 py-4 flex flex-col gap-2">
              <p class="text-[12px] text-muted">Noch keine Aufgaben vorhanden.</p>
              <p class="text-[11px] text-muted/70">Erstelle deine erste Aufgabe oben.</p>
            </div>
          {/if}
        {/each}
      </div>
    </div>

    <!-- ── Heute ── -->
    <div class="flex flex-col overflow-hidden bg-surface">
      <!-- Heute header / toolbar -->
      <div class="px-3 pt-3 pb-2 border-b border-border flex-shrink-0 bg-bg/60">
        <div class="flex items-center gap-3">
          <span class="text-[10px] font-bold uppercase tracking-[0.09em] text-muted">
            Heute
            {#if todayTasks.length > 0}
              <span class="font-normal normal-case tracking-normal text-accent ml-1">{todayTasks.length}</span>
            {/if}
          </span>
          {#if totalLabel}
            <span class="text-[11px] text-muted">· {totalLabel}</span>
          {/if}
          <span class="text-[11px] text-muted ml-auto">★ {mitIds.length}/3</span>
        </div>
        <p class="text-[11px] text-muted mt-0.5">
          {#if todayTasks.length === 0}
            Ziehe Aufgaben aus dem Pool hierher oder erstelle neue.
          {:else if mitIds.length === 0}
            Markiere bis zu 3 Aufgaben mit ★ als Top-Priorität.
          {:else}
            ⠿ Reihenfolge per Drag ändern · Dauer anklicken zum Bearbeiten
          {/if}
        </p>
      </div>

      <!-- Task rows -->
      <div class="flex-1 overflow-y-auto">
        {#each todayTasks as task, _i (task.id)}
          {@const isMit = mitIds.includes(task.id)}
          {@const col = projectColor(task)}
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div
            class="flex items-center gap-2 px-3 py-[9px] border-b border-border/60 cursor-grab select-none
              {isMit ? 'bg-accent-subtle border-l-[3px] border-l-accent' : 'hover:bg-bg/60'}
              {draggingId === task.id ? 'opacity-30' : ''}
              {dragOverId === task.id && draggingId !== task.id ? 'border-t-2 border-t-accent' : ''}"
            draggable="true"
            on:dragstart={e => onDragStart(e, task.id)}
            on:dragover={e => onDragOver(e, task.id)}
            on:drop={onDrop}
            on:dragend={onDragEnd}
          >
            <!-- Always-visible drag handle -->
            <span class="text-muted/40 text-[11px] flex-shrink-0 cursor-grab">⠿</span>

            <!-- MIT star -->
            <button
              on:click={() => toggleMit(task.id)}
              class="text-[13px] flex-shrink-0 transition-colors leading-none
                {isMit ? 'text-amber-400' : 'text-border-strong hover:text-amber-400'}"
              disabled={!isMit && mitIds.length >= 3}
              title={isMit ? 'Aus Top 3 entfernen' : mitIds.length < 3 ? 'Als Top 3 markieren' : '3 bereits gewählt'}
            >★</button>

            {#if col}
              <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background:{col}" />
            {/if}

            <span class="text-[13px] flex-1 min-w-0 truncate {isMit ? 'font-semibold text-primary' : 'text-primary'}">
              {task.title}
            </span>

            <!-- Duration: click to edit -->
            {#if editDurationId === task.id}
              <!-- svelte-ignore a11y-autofocus -->
              <input
                type="number"
                class="w-12 px-1 py-0.5 border border-accent rounded text-[11px] text-center outline-none bg-surface"
                value={task.estimatedMinutes ?? 30}
                min="5" step="5" autofocus
                on:blur={e => commitDuration(task, e.currentTarget.value)}
                on:keydown={e => { if (e.key === 'Enter') commitDuration(task, e.currentTarget.value); if (e.key === 'Escape') editDurationId = null; }}
              />
              <span class="text-[10px] text-muted">min</span>
            {:else}
              <button
                class="text-[11px] text-muted hover:text-accent flex-shrink-0 tabular-nums min-w-[32px] text-right"
                on:click={() => editDurationId = task.id}
                title="Dauer ändern"
              >{(task.estimatedMinutes ?? 0) < 60 ? (task.estimatedMinutes ?? 0) + 'm' : ((task.estimatedMinutes ?? 0) / 60) + 'h'}</button>
            {/if}

            <!-- Remove -->
            <button
              on:click={() => removeFromToday(task)}
              class="w-5 h-5 flex items-center justify-center rounded text-muted/50 hover:text-secondary hover:bg-bg transition-colors flex-shrink-0 text-[11px]"
              title="Aus Heute entfernen"
            >✕</button>
          </div>
        {:else}
          <div class="px-4 py-8 text-center">
            <p class="text-[13px] font-medium text-secondary mb-1">Noch leer</p>
            <p class="text-[11px] text-muted leading-relaxed">
              Klicke „→" neben einer Aufgabe im Pool<br/>oder erstelle direkt eine neue.
            </p>
          </div>
        {/each}
      </div>
    </div>

    <!-- ── Kalender ── -->
    <CalendarView planningMode={true} />

  </div>
</div>
