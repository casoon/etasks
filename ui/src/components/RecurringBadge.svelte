<script lang="ts">
  import type { RecurrenceRule } from '../domain/types';
  export let recurrence: RecurrenceRule;

  const LABELS: Record<string, string> = { daily: 'täglich', weekly: 'wöchentlich', monthly: 'monatlich' };
  $: label = LABELS[recurrence.frequency] ?? recurrence.frequency;
</script>

<span
  class="inline-flex items-center gap-[2px] text-[10px] text-muted px-[5px] py-[1px] rounded bg-bg whitespace-nowrap flex-shrink-0"
  title="Wiederkehrend: {label}"
>↺ {label}</span>
