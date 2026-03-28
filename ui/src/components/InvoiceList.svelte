<script lang="ts">
  import type { Client, Invoice } from '../domain/types';

  export let invoices: Invoice[] = [];
  export let clients: Client[] = [];
  export let selectedInvoiceId: string | null = null;
  export let onCreate: () => void;
  export let onSelect: (invoiceId: string) => void;

  $: invoicesByClient = (() => {
    const clientMap = new Map(clients.map((c) => [c.id, c]));
    const groups = new Map<string, { client: Client | null; invs: Invoice[] }>();
    for (const inv of invoices) {
      const key = inv.clientId || '__none';
      if (!groups.has(key)) groups.set(key, { client: clientMap.get(key) ?? null, invs: [] });
      groups.get(key)!.invs.push(inv);
    }
    return [...groups.values()]
      .map((g) => ({ ...g, invs: g.invs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }))
      .sort((a, b) => (!a.client ? 1 : !b.client ? -1 : a.client.name.localeCompare(b.client.name)));
  })();

  function statusLabel(status: Invoice['status']): string {
    return status === 'draft' ? 'Entwurf' : status === 'sent' ? 'Gesendet' : 'Bezahlt';
  }

  function statusBadgeClass(status: Invoice['status']): string {
    return status === 'draft'
      ? 'bg-gray-100 text-gray-600'
      : status === 'sent'
        ? 'bg-blue-100 text-blue-700'
        : 'bg-green-100 text-green-700';
  }
</script>

<div class="border-r border-border flex flex-col overflow-hidden">
  <div class="px-4 py-3 flex-shrink-0 border-b border-border">
    <button class="w-full px-3 py-2 rounded-lg bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity" on:click={onCreate}>+ Neue Rechnung</button>
  </div>
  <div class="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1">
    {#if invoices.length === 0}
      <p class="text-[13px] text-muted px-2 py-4 leading-relaxed">Noch keine Rechnungen.</p>
    {/if}
    {#each invoicesByClient as group (group.client?.id ?? '__none')}
      <p class="text-[10px] font-bold uppercase tracking-widest text-muted px-2 pt-3 pb-1">{group.client?.name ?? 'Ohne Kunde'}</p>
      {#each group.invs as inv (inv.id)}
        <button class="flex items-center gap-2 py-[6px] px-2 rounded-lg w-full text-left transition-colors min-w-0 {selectedInvoiceId === inv.id ? 'bg-accent-subtle' : 'hover:bg-bg'}" on:click={() => onSelect(inv.id)}>
          <div class="flex-1 min-w-0">
            <p class="text-[12px] font-mono overflow-hidden text-ellipsis whitespace-nowrap {selectedInvoiceId === inv.id ? 'text-accent font-semibold' : 'text-primary'}">{inv.invoiceNumber}</p>
            <p class="text-[11px] text-muted">{inv.date}</p>
          </div>
          <span class="text-[10px] px-[6px] py-[2px] rounded-full flex-shrink-0 {statusBadgeClass(inv.status)}">{statusLabel(inv.status)}</span>
        </button>
      {/each}
    {/each}
  </div>
</div>
