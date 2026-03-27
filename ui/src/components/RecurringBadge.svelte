<script lang="ts">
  import type { RecurrenceRule } from '../domain/types';
  export let recurrence: RecurrenceRule;

  const LABELS: Record<string, string> = { daily: 'täglich', weekly: 'wöchentlich', monthly: 'monatlich' };
  $: label = LABELS[recurrence.frequency] ?? recurrence.frequency;
</script>

<span class="recurring-badge" title="Wiederkehrend: {label}">↺ {label}</span>
