<!-- @core -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { $toasts as toastsStore, dismissToast } from '../../stores/toastStore';
  import type { Toast } from '../../stores/toastStore';

  let toasts: Toast[] = toastsStore.get();
  onDestroy(toastsStore.subscribe(v => { toasts = [...v]; }));

  const icons = {
    success: 'M5 12l5 5 9-10',
    error:   'M6 6l12 12M18 6L6 18',
    info:    'M12 11v6M12 7h.01',
  };

  const colors = {
    success: 'bg-success/10 border-success/30 text-success',
    error:   'bg-danger/10 border-danger/30 text-danger',
    info:    'bg-accent/10 border-accent/30 text-accent',
  };
</script>

<div
  class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
  aria-live="polite"
  aria-label="Benachrichtigungen"
>
  {#each toasts as t (t.id)}
    <div
      class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-overlay
             bg-surface text-primary text-[13px] min-w-[260px] max-w-[360px]
             animate-fade-in-up {colors[t.type]}"
    >
      <span
        class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center border {colors[t.type]}"
        aria-hidden="true"
      ><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d={icons[t.type]}></path></svg></span>
      <span class="flex-1 text-primary">{t.message}</span>
      <button
        on:click={() => dismissToast(t.id)}
        class="et-btn et-btn-ghost et-btn-icon et-btn-sm flex-shrink-0"
        aria-label="Schließen"
      ><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button>
    </div>
  {/each}
</div>