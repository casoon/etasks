<script lang="ts">
  import { $energyCheckPending as pendingStore } from '../stores/uiStore';
  import { resetBreakTimer } from '../lib/notificationScheduler';
  import { today } from '../domain/dateUtils';

  const ENERGY_KEY = 'etasks.energy-log';

  type EnergyLevel = 'low' | 'medium' | 'high';

  function saveEnergy(level: EnergyLevel) {
    try {
      const raw = localStorage.getItem(ENERGY_KEY);
      const log: { date: string; time: string; level: EnergyLevel }[] = raw ? JSON.parse(raw) : [];
      log.push({ date: today(), time: new Date().toTimeString().slice(0, 5), level });
      // Keep last 30 entries
      localStorage.setItem(ENERGY_KEY, JSON.stringify(log.slice(-30)));
    } catch {}
    resetBreakTimer();
    pendingStore.set(false);
  }

  function dismiss() {
    resetBreakTimer();
    pendingStore.set(false);
  }
</script>

{#if $pendingStore}
  <div
    class="fixed bottom-5 right-5 z-50 bg-surface border border-border rounded-2xl shadow-xl p-4 flex flex-col gap-3 w-60 animate-fade-in"
    role="dialog"
    aria-label="Energie-Check"
  >
    <div class="flex items-center justify-between">
      <p class="text-[13px] font-semibold text-primary">Wie ist deine Energie?</p>
      <button
        class="text-muted text-sm hover:text-primary transition-colors"
        on:click={dismiss}
        aria-label="Schließen"
      >×</button>
    </div>
    <p class="text-[11px] text-secondary">Zeit für eine kurze Pause.</p>
    <div class="flex gap-2">
      <button
        class="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border border-border hover:bg-bg transition-colors"
        on:click={() => saveEnergy('low')}
        title="Müde"
      >
        <span class="text-xl">😴</span>
        <span class="text-[10px] text-muted">Müde</span>
      </button>
      <button
        class="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border border-border hover:bg-bg transition-colors"
        on:click={() => saveEnergy('medium')}
        title="OK"
      >
        <span class="text-xl">😐</span>
        <span class="text-[10px] text-muted">OK</span>
      </button>
      <button
        class="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border border-border hover:bg-bg transition-colors"
        on:click={() => saveEnergy('high')}
        title="Top"
      >
        <span class="text-xl">⚡</span>
        <span class="text-[10px] text-muted">Top</span>
      </button>
    </div>
  </div>
{/if}
