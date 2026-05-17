<!-- @core -->
<script lang="ts">
  export let icon = '○';
  export let title: string;
  export let description: string | undefined = undefined;
  export let actionLabel: string | undefined = undefined;
  export let onAction: (() => void) | undefined = undefined;
</script>

<div class="flex flex-col items-center justify-center py-10 px-4 text-center animate-fade-in">
  <div class="text-2xl text-muted/40 mb-3 select-none">{icon}</div>
  <p class="text-[13px] font-medium text-secondary">{title}</p>
  {#if description}
    <p class="text-[12px] text-muted mt-1 leading-relaxed max-w-[180px]">{description}</p>
  {/if}
  {#if actionLabel && onAction}
    <button
      on:click={onAction}
      class="mt-4 px-3 py-1.5 text-[12px] font-medium text-accent border border-accent/30
             rounded-lg hover:bg-accent/10 transition-colors"
    >
      + {actionLabel}
    </button>
  {/if}
</div>