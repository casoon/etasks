<!-- @module:calendar -->
<script lang="ts">
  import type { CalendarBlock } from '../../domain/types';
  import { formatTime } from '../../domain/dateUtils';
  import { $tasks as tasksStore } from '../../stores/taskStore';

  export let block: CalendarBlock;
  export let top: number;
  export let height: number;
  export let onMoveStart: ((block: CalendarBlock, e: PointerEvent) => void) | undefined = undefined;
  export let onRemove: ((block: CalendarBlock) => void) | undefined = undefined;

  $: task = block.taskId ? $tasksStore.find(t => t.id === block.taskId) : null;

  function handlePointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('button')) return;
    onMoveStart?.(block, e);
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="cal-block group absolute left-10 right-1 rounded-[7px] px-2 py-1 cursor-grab box-border flex items-start gap-1 z-[2] overflow-hidden transition-shadow min-h-[24px] "
  data-block-id={block.id}
  style="top:{top}px; height:{Math.max(height, 24)}px; background:var(--et-accent-soft); border:1px solid var(--et-accent); color:var(--et-accent-strong)"
  on:pointerdown={handlePointerDown}
>
  <div class="flex-1 min-w-0 flex flex-col gap-[1px]">
    <span class="text-[12px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap">{block.title ?? task?.title}</span>
    <span class="text-[11px] whitespace-nowrap">{formatTime(block.start)} – {formatTime(block.end)}</span>
  </div>
  <button
    class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 w-6 h-6 -my-0.5 flex items-center justify-center rounded flex-shrink-0 hover:bg-white/60 transition-opacity"
    on:click={() => onRemove?.(block)}
    aria-label="Block {block.title ?? task?.title ?? ''} entfernen"
  >
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>
  </button>
</div>
