<!-- @core -->
<script lang="ts">
  import { $energyCheckPending as pendingStore } from '../../stores/uiStore';
  import { resetBreakTimer } from '../../lib/notificationScheduler';

  function dismiss() {
    resetBreakTimer();
    pendingStore.set(false);
  }
</script>

{#if $pendingStore}
  <div
    class="fixed bottom-5 right-5 z-50 p-4 flex flex-col gap-3 w-64 rounded-[14px] animate-fade-in"
    style="background:var(--et-surface);border:1px solid var(--et-border);box-shadow:var(--et-shadow-overlay)"
    role="dialog"
    aria-labelledby="energy-title"
  >
    <div class="flex items-center justify-between">
      <h2 id="energy-title" class="text-[14px] font-semibold">Wie ist deine Energie?</h2>
      <button class="et-btn et-btn-ghost et-btn-icon et-btn-sm" on:click={dismiss} aria-label="Schließen">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>
      </button>
    </div>
    <p class="text-[13px]" style="color:var(--et-text-3)">Zeit für eine kurze Pause.</p>
    <div class="flex gap-2">
      <button class="et-btn flex-col h-auto min-h-[64px] gap-1 py-2 flex-1" on:click={dismiss}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h5l-5 6h5M13 4h4l-4 5h4M15 15h5l-5 5h5"></path></svg>
        <span class="text-[12px] font-medium">Müde</span>
      </button>
      <button class="et-btn flex-col h-auto min-h-[64px] gap-1 py-2 flex-1" on:click={dismiss}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M8 12h8"></path></svg>
        <span class="text-[12px] font-medium">OK</span>
      </button>
      <button class="et-btn flex-col h-auto min-h-[64px] gap-1 py-2 flex-1" on:click={dismiss}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 3L5 13h6l-1 8 8-10h-6z"></path></svg>
        <span class="text-[12px] font-medium">Top</span>
      </button>
    </div>
  </div>
{/if}
