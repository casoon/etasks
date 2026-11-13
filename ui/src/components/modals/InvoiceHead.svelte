<!-- @module:billing -->
<script lang="ts">
  import type { Client, Invoice } from '../../domain/types';
  import { diffDays } from '../../domain/dateUtils';

  export let invoice: Invoice;
  export let clients: Client[] = [];
  export let numberPrefix = 'RE-';
  export let numberProblem = '';
  export let onUpdate: (patch: Partial<Omit<Invoice, 'id' | 'createdAt'>>) => void;
  export let onClientChange: (clientId: string) => void;

  $: terms = diffDays(invoice.date, invoice.dueDate);

  function text(field: 'invoiceNumber' | 'customerNumber' | 'performancePeriod' | 'projectReference' | 'notes') {
    return (e: Event) => onUpdate({ [field]: (e.currentTarget as HTMLInputElement | HTMLTextAreaElement).value });
  }
  function date(field: 'date' | 'dueDate') {
    return (e: Event) => onUpdate({ [field]: (e.currentTarget as HTMLInputElement).value });
  }
</script>

<section aria-label="Rechnungskopf" class="et-card grid gap-x-4 gap-y-3.5 px-5 py-[18px]" style="grid-template-columns:repeat(auto-fit,minmax(min(170px,100%),1fr))">
  <div class="flex flex-col gap-1.5">
    <label class="et-label" for="inv-client">Kunde</label>
    <select id="inv-client" class="et-field" value={invoice.clientId} on:change={(e) => onClientChange(e.currentTarget.value)}>
      <option value="">Kein Kunde</option>
      {#each clients as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
    </select>
  </div>
  <div class="flex flex-col gap-1.5">
    <label class="et-label" for="inv-number">Rechnungsnummer</label>
    <input
      id="inv-number"
      class="et-field"
      style={numberProblem ? 'border-color:var(--et-danger)' : ''}
      value={invoice.invoiceNumber}
      placeholder={`${numberPrefix}001`}
      aria-invalid={numberProblem ? 'true' : undefined}
      aria-describedby={numberProblem ? 'inv-number-problem' : undefined}
      on:input={text('invoiceNumber')}
    />
    {#if numberProblem}<span id="inv-number-problem" class="text-[12px]" style="color:var(--et-danger)">{numberProblem}</span>{/if}
  </div>
  <div class="flex flex-col gap-1.5">
    <label class="et-label" for="inv-date">Rechnungsdatum</label>
    <input id="inv-date" class="et-field" type="date" lang="de" value={invoice.date} on:input={date('date')} />
  </div>
  <div class="flex flex-col gap-1.5">
    <label class="et-label" for="inv-due">Fällig am{terms !== null && terms >= 0 ? ` · ${terms} ${terms === 1 ? 'Tag' : 'Tage'}` : ''}</label>
    <input id="inv-due" class="et-field" type="date" lang="de" value={invoice.dueDate} on:input={date('dueDate')} />
  </div>
  <div class="flex flex-col gap-1.5">
    <label class="et-label" for="inv-customer-number">Kundennummer</label>
    <input id="inv-customer-number" class="et-field" value={invoice.customerNumber ?? ''} placeholder="Kunden-Nr." on:input={text('customerNumber')} />
  </div>
  <div class="flex flex-col gap-1.5">
    <label class="et-label" for="inv-period">Leistungszeitraum</label>
    <input id="inv-period" class="et-field" value={invoice.performancePeriod ?? ''} placeholder="z. B. 01.–12.11.2026" on:input={text('performancePeriod')} />
  </div>
  <div class="flex flex-col gap-1.5" style="grid-column:span 2">
    <label class="et-label" for="inv-reference">Projektbezug (optional)</label>
    <input id="inv-reference" class="et-field" value={invoice.projectReference ?? ''} placeholder="z. B. Website-Relaunch" on:input={text('projectReference')} />
  </div>
  <div class="flex flex-col gap-1.5" style="grid-column:1/-1">
    <label class="et-label" for="inv-notes">Anmerkungen (intern, werden nicht gedruckt)</label>
    <textarea id="inv-notes" class="et-field resize-y" rows="2" value={invoice.notes ?? ''} on:input={text('notes')}></textarea>
  </div>
</section>
