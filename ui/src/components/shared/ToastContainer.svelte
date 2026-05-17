<!-- @core -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { $toasts as toastsStore, dismissToast } from '../../stores/toastStore';
  import type { Toast } from '../../stores/toastStore';

  let toasts: Toast[] = toastsStore.get();
  onDestroy(toastsStore.subscribe(v => { toasts = [...v]; }));

  const icons = {
    success: '✓',
    error:   '✕',
    info:    'i',
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
        class="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold border {colors[t.type]}"
        aria-hidden="true"
      >{icons[t.type]}</span>
      <span class="flex-1 text-primary">{t.message}</span>
      <button
        on:click={() => dismissToast(t.id)}
        class="flex-shrink-0 text-muted hover:text-primary transition-colors ml-1"
        aria-label="Schließen"
      >✕</button>
    </div>
  {/each}
</div>