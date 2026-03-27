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

<div class="flex flex-col overflow-hidden min-w-0">
  <div class="flex items-center gap-2 px-4 pt-4 pb-3 flex-shrink-0">
    <h2 class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted whitespace-nowrap overflow-hidden text-ellipsis flex-1">Kalender</h2>
    <ICSImportButton />
  </div>

  <div class="flex-1 overflow-y-auto px-3 pb-6">
    <div class="relative w-full min-h-full" bind:this={gridEl}>
      {#each HOURS as hour (hour)}
        <div class="relative flex items-start border-t border-border-subtle" style="height:{HOUR_HEIGHT}px">
          <span class="text-[11px] text-muted w-10 pt-1 flex-shrink-0 select-none">{String(hour).padStart(2, '0')}:00</span>
          <div class="flex-1 h-px bg-border-subtle mt-[10px]" />
          {#each [0, 15, 30, 45] as min (min)}
            {@const d = new Date()}
            {d.setHours(hour, min, 0, 0)}
            <div
              class="absolute left-10 right-0 z-[1]"
              data-time-slot={d.toISOString()}
              style="top:{(min / 60) * HOUR_HEIGHT}px; height:{HOUR_HEIGHT / 4}px"
            />
          {/each}
        </div>
      {/each}

      {#if showNowLine}
        <div class="absolute left-10 right-0 h-[2px] bg-red-500 z-[3] pointer-events-none" style="top:{nowTop}px">
          <div class="absolute -left-1 -top-1 w-[10px] h-[10px] rounded-full bg-red-500" />
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
