<script lang="ts">
  import { $todayBlocks as todayBlocksStore, moveBlock } from '../stores/calendarStore';
  import CalendarBlockComponent from './CalendarBlock.svelte';
  import ICSImportButton from './ICSImportButton.svelte';
  import { getBlockTop, getBlockHeight, snapToGrid } from '../domain/calendarService';
  import type { CalendarBlock } from '../domain/types';

  const DAY_START = 6;
  const DAY_END = 20;
  const HOUR_HEIGHT = 64;
  const HOURS = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);

  $: blocks = $todayBlocksStore;

  let gridEl: HTMLDivElement;

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
      moveBlock(block.id, getTimeFromY(clampedY));
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
</script>

<div class="calendar-view">
  <div class="calendar-header">
    <h2 class="column-title">Kalender</h2>
    <ICSImportButton />
  </div>

  <div class="calendar-scroll">
    <div class="time-grid" bind:this={gridEl}>
      {#each HOURS as hour (hour)}
        <div class="hour-row" style="height:{HOUR_HEIGHT}px">
          <span class="hour-label">{String(hour).padStart(2, '0')}:00</span>
          <div class="hour-line" />
          {#each [0, 15, 30, 45] as min (min)}
            {@const d = new Date()}
            {d.setHours(hour, min, 0, 0)}
            <div
              class="time-slot"
              data-time-slot={d.toISOString()}
              style="top:{(min / 60) * HOUR_HEIGHT}px; height:{HOUR_HEIGHT / 4}px"
            />
          {/each}
        </div>
      {/each}

      {#if showNowLine}
        <div class="now-line" style="top:{nowTop}px">
          <div class="now-dot" />
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
        />
      {/each}
    </div>
  </div>
</div>
