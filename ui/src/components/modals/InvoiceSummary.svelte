<!-- @module:billing -->
<script lang="ts">
  import type { Invoice, InvoiceStatus } from '../../domain/types';
  import { formatEuro, type InvoiceTotals } from '../../lib/invoiceMoney';
  import type { InvoiceCheck, CheckFix } from '../../lib/invoiceChecklist';
  import { statusBlockedReason } from '../../lib/invoiceStatus';

  export let invoice: Invoice;
  export let totals: InvoiceTotals;
  export let checks: InvoiceCheck[] = [];
  export let numberProblem = '';
  export let pdfAvailable = false;
  export let pdfBusy = false;
  export let onGeneratePdf: () => void | Promise<void>;
  export let onSetStatus: (status: InvoiceStatus) => void;
  export let onDelete: () => void;
  export let onFix: (target: CheckFix) => void;

  $: failing = checks.filter((c) => !c.ok);
  $: firstProblem = failing[0];
  $: pdfBlocked = failing.length > 0 || !pdfAvailable || pdfBusy;
  $: sendBlockedReason = numberProblem || statusBlockedReason(invoice, 'sent');
  $: paidBlockedReason = statusBlockedReason(invoice, 'paid');
</script>

<aside aria-label="Zusammenfassung" class="et-card flex flex-col gap-3.5 p-5 flex-[1_1_280px] max-w-[340px] min-w-0">
  <h2 class="et-h2">Summe</h2>
  <div class="flex flex-col gap-2 tabular-nums">
    <div class="flex"><span class="flex-1" style="color:var(--et-text-3)">Netto</span><span>{formatEuro(totals.nettoCents)}</span></div>
    {#each totals.vatEntries as v (v.rate)}
      <div class="flex"><span class="flex-1" style="color:var(--et-text-3)">MwSt. {v.rate} %</span><span>{formatEuro(v.amountCents)}</span></div>
    {/each}
    <div class="flex pt-2.5 border-t text-[18px] font-bold" style="border-color:var(--et-border)"><span class="flex-1">Brutto</span><span>{formatEuro(totals.totalCents)}</span></div>
  </div>

  <ul class="flex flex-col gap-2 py-3 border-t text-[13px] list-none m-0 pl-0" style="border-color:var(--et-border-subtle)" aria-label="Prüfliste">
    {#each checks as c (c.id)}
      <li class="flex items-start gap-2" style="color:{c.ok ? 'inherit' : 'var(--et-warning-text)'}">
        {#if c.ok}
          <svg class="flex-shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--et-success)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg>
          <span><span class="sr-only">Erledigt: </span>{c.text}</span>
        {:else}
          <svg class="flex-shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5"></path><circle cx="12" cy="12" r="9"></circle></svg>
          <span>
            <span class="sr-only">Offen: </span>{c.text}
            {#if c.fix}
              {@const fix = c.fix}
              <button class="block min-h-9 font-semibold underline text-left" style="color:var(--et-accent-strong)" on:click={() => onFix(fix.target)}>{fix.label}</button>
            {/if}
          </span>
        {/if}
      </li>
    {/each}
  </ul>

  <button class="et-btn et-btn-primary h-12" disabled={pdfBlocked} aria-describedby="inv-pdf-reason" on:click={onGeneratePdf}>
    {pdfBusy ? 'PDF wird erstellt …' : invoice.pdfPath ? 'PDF neu erzeugen' : 'PDF erzeugen'}
  </button>
  <p id="inv-pdf-reason" class="text-[12px]" style="color:var(--et-text-3)">
    {#if firstProblem}
      Das PDF lässt sich erzeugen, sobald alles geprüft ist: {firstProblem.text}
    {:else if !pdfAvailable}
      PDF-Rechnungen gibt es nur in der Desktop-App; sie werden im Standard-Exportordner gespeichert.
    {:else if invoice.pdfPath}
      Zuletzt erzeugt: {invoice.pdfPath}
    {:else}
      Das PDF wird im Standard-Exportordner der Desktop-App gespeichert. Danach kannst du die Rechnung als gesendet markieren.
    {/if}
  </p>

  {#if invoice.status === 'draft'}
    <button class="et-btn" disabled={Boolean(sendBlockedReason)} aria-describedby={sendBlockedReason ? 'inv-send-reason' : undefined} on:click={() => onSetStatus('sent')}>Als gesendet markieren</button>
    {#if sendBlockedReason}<p id="inv-send-reason" class="text-[12px]" style="color:var(--et-text-3)">{sendBlockedReason}</p>{/if}
  {/if}
  {#if invoice.status !== 'paid'}
    <button class="et-btn" disabled={Boolean(paidBlockedReason)} aria-describedby={paidBlockedReason ? 'inv-paid-reason' : undefined} on:click={() => onSetStatus('paid')}>Als bezahlt markieren</button>
    {#if paidBlockedReason}<p id="inv-paid-reason" class="text-[12px]" style="color:var(--et-text-3)">{paidBlockedReason}</p>{/if}
  {/if}
  {#if invoice.status === 'paid'}
    <button class="et-btn" on:click={() => onSetStatus('sent')}>Zurück auf „Gesendet“</button>
  {/if}
  {#if invoice.status !== 'draft'}
    <button class="et-btn" on:click={() => onSetStatus('draft')}>Zurück auf „Entwurf“</button>
    <p class="text-[12px]" style="color:var(--et-text-3)">
      Diese Rechnung ist bereits {invoice.status === 'paid' ? 'bezahlt' : 'gesendet'}. Änderungen an Nummer oder Datum stimmen dann nicht mehr mit dem ausgestellten Dokument überein.
    </p>
  {/if}
  <button class="et-btn et-btn-danger border-transparent bg-transparent" on:click={onDelete}>{invoice.status === 'draft' ? 'Entwurf löschen' : 'Rechnung löschen'}</button>
</aside>
