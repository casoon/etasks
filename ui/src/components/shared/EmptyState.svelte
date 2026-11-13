<!-- @core -->
<script lang="ts">
  export let title: string;
  export let description: string | undefined = undefined;
  export let actionLabel: string | undefined = undefined;
  export let onAction: (() => void) | undefined = undefined;
</script>

<div class="flex flex-col items-center justify-center py-10 px-4 text-center animate-fade-in">
  <span class="mb-3 select-none" style="color:var(--et-border-control)" aria-hidden="true">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M8 12.5l3 3 5-6"></path></svg>
  </span>
  <p class="text-[14px] font-semibold" style="color:var(--et-text-2)">{title}</p>
  {#if description}
    <p class="text-[13px] mt-1 leading-relaxed max-w-[240px]" style="color:var(--et-text-3)">{description}</p>
  {/if}
  {#if actionLabel && onAction}
    <button on:click={onAction} class="et-btn et-btn-accent mt-4">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>
      {actionLabel}
    </button>
  {/if}
</div>
