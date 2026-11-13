<!-- @module:projects -->
<script lang="ts">
  import { PROJECT_COLORS } from '../../domain/types';

  export let color: string;
  export let onPick: (color: string) => void;
  export let label = 'Projektfarbe';

  // Names follow the order of PROJECT_COLORS.
  const NAMES = ['Blau', 'Violett', 'Rosa', 'Gelb', 'Grün', 'Rot', 'Türkis', 'Limette', 'Orange', 'Indigo'];
</script>

<div class="flex flex-wrap gap-2" role="group" aria-label={label}>
  {#each PROJECT_COLORS as c, i (c)}
    <button
      class="w-9 h-9 rounded-lg flex items-center justify-center text-white"
      style="background:{c};{color === c ? 'box-shadow:0 0 0 2px var(--et-surface),0 0 0 4px var(--et-text)' : ''}"
      aria-pressed={color === c}
      aria-label={NAMES[i] ?? c}
      title={NAMES[i] ?? c}
      on:click={() => onPick(c)}
    >
      {#if color === c}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="filter:drop-shadow(0 0 1px rgba(0,0,0,.6))"><path d="M5 12l5 5 9-10"></path></svg>
      {/if}
    </button>
  {/each}
</div>
