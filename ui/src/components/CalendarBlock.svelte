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
  class="cal-block"
  data-block-id={block.id}
  style="top:{top}px; height:{Math.max(height, 24)}px; background:{color}"
  on:pointerdown={handlePointerDown}
>
  <div class="cal-block-content">
    <span class="cal-block-title">{block.title ?? task?.title}</span>
    <span class="cal-block-time">{formatTime(block.start)} – {formatTime(block.end)}</span>
  </div>
  <button class="cal-block-remove" on:click={() => removeBlock(block.id)} aria-label="Block entfernen">×</button>
</div>
