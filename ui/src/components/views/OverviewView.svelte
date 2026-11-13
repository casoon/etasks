<!-- @core -->
<script lang="ts">
  import { $navItem as navItemStore, openToday } from '../../stores/uiStore';
  import { $todayTasks as todayTasksStore } from '../../stores/taskStore';
  import { $bridgeInvoices as invoicesStore } from '../../stores/coreBridge';
  import { unpaidInvoiceCount } from '../../lib/navigation';
  import type { NavItem } from '../../domain/types';

  $: openToday_ = $todayTasksStore.filter(t => t.status === 'todo').length;
  $: unpaid = unpaidInvoiceCount($invoicesStore);

  $: tiles = [
    { label: 'Aufgaben heute', value: String(openToday_), hint: 'offen', nav: 'today' as NavItem },
    { label: 'Offene Rechnungen', value: String(unpaid), hint: 'gesendet, nicht bezahlt', nav: 'invoices' as NavItem },
  ];
</script>

<div class="flex-1 overflow-y-auto px-8 pt-5 pb-7 flex flex-col gap-5">
  <header class="flex items-center gap-4">
    <h1 class="text-[24px] font-bold tracking-[-0.01em] text-primary flex-1">Übersicht</h1>
    <button
      class="min-h-[44px] px-4 rounded-[10px] border border-border-strong bg-surface text-[14px] font-semibold text-secondary hover:bg-bg"
      on:click={() => openToday('plan')}
    >Tag planen</button>
    <button
      class="min-h-[44px] px-4 rounded-[10px] bg-accent text-white text-[14px] font-semibold hover:opacity-90"
      on:click={() => openToday('work')}
    >Weiterarbeiten</button>
  </header>

  <div class="grid gap-3" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))">
    {#each tiles as tile (tile.nav)}
      <button
        class="flex flex-col gap-1 p-4 rounded-xl border border-border bg-surface text-left hover:bg-bg"
        on:click={() => navItemStore.set(tile.nav)}
      >
        <span class="text-[12px] font-semibold uppercase tracking-[0.05em] text-secondary">{tile.label}</span>
        <span class="text-[26px] font-bold text-primary tabular-nums">{tile.value}</span>
        <span class="text-[13px] text-secondary">{tile.hint}</span>
      </button>
    {/each}
  </div>
</div>
