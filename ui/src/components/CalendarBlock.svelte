<script lang="ts">
  import type { CalendarBlock } from '../domain/types';
  import { formatTime } from '../domain/dateUtils';
  import { removeBlock } from '../stores/calendarStore';
  import { TAG_COLORS } from '../domain/types';
  import { $tasks as tasksStore } from '../stores/taskStore';

  export let block: CalendarBlock;
  export let top: number;
  export let height: number;
  export let onMoveStart: ((block: CalendarBlock, e: PointerEvent) => void) | undefined = undefined;

  $: task = block.taskId ? $tasksStore.find(t => t.id === block.taskId) : null;
  $: tag = task?.tags?.[0];
  $: color = tag ? (TAG_COLORS[tag] ?? '#bfdbfe') : '#bfdbfe';

  function handlePointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('button')) return;
    onMoveStart?.(block, e);
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="cal-block group absolute left-[44px] right-3 rounded-lg px-2 py-1 cursor-grab flex items-start gap-1 z-[2] overflow-hidden transition-shadow min-h-[24px] hover:shadow-card"
  data-block-id={block.id}
  style="top:{top}px; height:{Math.max(height, 24)}px; background:{color}"
  on:pointerdown={handlePointerDown}
>
  <div class="flex-1 min-w-0 flex flex-col gap-[1px]">
    <span class="text-[12px] font-medium text-primary overflow-hidden text-ellipsis whitespace-nowrap">{block.title ?? task?.title}</span>
    <span class="text-[10px] text-secondary whitespace-nowrap">{formatTime(block.start)} – {formatTime(block.end)}</span>
  </div>
  <button
    class="opacity-0 group-hover:opacity-100 text-sm text-secondary leading-none flex-shrink-0 transition-opacity"
    on:click={() => removeBlock(block.id)}
    aria-label="Block entfernen"
  >×</button>
</div>
