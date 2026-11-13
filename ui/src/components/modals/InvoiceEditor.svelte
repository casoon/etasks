<!-- @module:billing -->
<script lang="ts">
    import type {
        BillingItem,
        Client,
        Invoice,
        InvoiceStatus,
        ServiceItem,
        Task,
        TimeEntry,
        Termin,
    } from "../../domain/types";
    import { calcInvoiceTotals } from "../../lib/invoiceMoney";
    import { isInvoiceNumberTaken } from "../../lib/invoiceNumber";
    import { buildInvoiceChecks, type CheckFix } from "../../lib/invoiceChecklist";
    import { displayStatus, invoiceStep } from "../../lib/invoiceStatus";
    import { today } from "../../domain/dateUtils";
    import { $selectedClientId as selectedClientIdStore } from "../../stores/projectStore";
    import { $navItem as navItemStore } from "../../stores/uiStore";
    import InvoiceHead from "./InvoiceHead.svelte";
    import InvoiceLines from "./InvoiceLines.svelte";
    import InvoiceSummary from "./InvoiceSummary.svelte";
    import InvoiceStatusBadge from "./InvoiceStatusBadge.svelte";

    export let invoice: Invoice;
    export let clients: Client[] = [];
    export let services: ServiceItem[] = [];
    export let tasks: Task[] = [];
    export let projects: Array<{ id: string; name: string; clientId: string }> = [];
    export let appConfig: {
        profile?: {
            default_vat_rate?: number;
            invoice_number_prefix?: string;
            hourly_rate?: number;
        };
    } | null = null;
    export let missingProfileFields: string[] = [];
    export let billingItems: readonly BillingItem[] = [];
    export let unlockedBillingItemIds: readonly string[] = [];
    export let timeEntries: readonly TimeEntry[] = [];
    export let termine: readonly Termin[] = [];
    export let blockedTaskIds: Set<string> = new Set();
    export let otherInvoiceNumbers: string[] = [];
    export let pdfAvailable = false;
    export let pdfBusy = false;
    export let onBack: () => void;
    export let onUpdate: (
        patch: Partial<Omit<Invoice, "id" | "createdAt">>,
    ) => void;
    export let onDelete: () => void;
    export let onGeneratePdf: () => void | Promise<void>;
    export let onSetStatus: (status: InvoiceStatus) => void;

    let lines: InvoiceLines;

    $: client = clients.find((c) => c.id === invoice.clientId);
    $: totals = calcInvoiceTotals(invoice.lineItems);
    $: numberProblem = !invoice.invoiceNumber.trim()
        ? "Bitte eine Rechnungsnummer angeben."
        : isInvoiceNumberTaken(invoice.invoiceNumber, otherInvoiceNumbers)
          ? "Diese Rechnungsnummer ist bereits vergeben."
          : "";
    $: checks = buildInvoiceChecks({ invoice, client, numberProblem, missingProfileFields });
    $: step = invoiceStep(invoice, checks.every((c) => c.ok));
    $: steps = ["Daten prüfen", "PDF erzeugen", "Als gesendet markieren", "Bezahlt"];

    function handleClientChange(clientId: string) {
        const next = clients.find((entry) => entry.id === clientId);
        lines?.flush();
        onUpdate({
            clientId,
            customerNumber: next?.customerNumber ?? "",
            // Aufgaben gehören zum bisherigen Kunden und würden sonst auf der neuen Rechnung hängen bleiben.
            lineItems: invoice.lineItems.map((li) => ({ ...li, taskIds: [] })),
        });
    }

    function fix(target: CheckFix) {
        if (target === "client-address") {
            selectedClientIdStore.set(invoice.clientId);
            navItemStore.set("clients");
        } else if (target === "profile") {
            navItemStore.set("settings");
        } else {
            const id = { client: "inv-client", number: "inv-number", positions: "inv-add-free" }[target];
            const el = document.getElementById(id);
            el?.scrollIntoView({ block: "center" });
            el?.focus();
        }
    }
</script>

<div class="flex-1 overflow-y-auto">
    <div class="flex flex-col gap-3.5 px-8 pt-4 pb-7">
        <nav aria-label="Pfad" class="flex items-center gap-2 text-[13px]">
            <button class="flex items-center gap-1.5 min-h-11 font-semibold" style="color:var(--et-accent)" on:click={onBack}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"></path></svg>
                Rechnungen
            </button>
            <span aria-hidden="true" style="color:var(--et-border-control)">/</span>
            <span class="font-semibold" aria-current="page">{invoice.invoiceNumber || "Ohne Nummer"}</span>
            <span class="flex-1"></span>
            <span style="color:var(--et-text-3)">Änderungen werden automatisch gespeichert</span>
        </nav>

        <header class="flex flex-wrap items-center gap-x-5 gap-y-3">
            <h1 class="text-[24px] font-bold tracking-[-0.01em]">{invoice.invoiceNumber || "Ohne Nummer"}</h1>
            <InvoiceStatusBadge status={displayStatus(invoice, today())} />
            <span class="flex-1"></span>
            <ol aria-label="Ablauf" class="flex flex-wrap items-center gap-2 m-0 p-0 list-none text-[13px]">
                {#each steps as label, i (label)}
                    {#if i > 0}<li aria-hidden="true" class="w-6 h-px" style="background:var(--et-border-control)"></li>{/if}
                    <li class="flex items-center gap-2" style="font-weight:{step === i + 1 ? 600 : 400};color:{step === i + 1 ? 'inherit' : 'var(--et-text-2)'}" aria-current={step === i + 1 ? "step" : undefined}>
                        {#if step > i + 1}
                            <span class="w-[22px] h-[22px] rounded-full flex items-center justify-center" style="background:var(--et-success);color:#fff">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg>
                            </span>
                            <span class="sr-only">Erledigt: </span>
                        {:else}
                            <span class="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[12px] font-semibold box-border" style={step === i + 1 ? "background:var(--et-accent);color:#fff" : "border:1.5px solid var(--et-border-control)"}>{i + 1}</span>
                        {/if}
                        {label}
                    </li>
                {/each}
            </ol>
        </header>

        <div class="flex flex-wrap items-start gap-5">
            <div class="flex-[999_1_520px] min-w-0 flex flex-col gap-4">
                <InvoiceHead
                    {invoice}
                    {clients}
                    numberPrefix={appConfig?.profile?.invoice_number_prefix?.trim() || "RE-"}
                    {numberProblem}
                    {onUpdate}
                    onClientChange={handleClientChange}
                />
                <InvoiceLines
                    bind:this={lines}
                    {invoice}
                    {client}
                    {services}
                    {tasks}
                    {projects}
                    defaultVatRate={appConfig?.profile?.default_vat_rate ?? 19}
                    profileHourlyRate={appConfig?.profile?.hourly_rate}
                    {billingItems}
                    {unlockedBillingItemIds}
                    {timeEntries}
                    {termine}
                    {blockedTaskIds}
                    {onUpdate}
                />
            </div>
            <InvoiceSummary
                {invoice}
                {totals}
                {checks}
                {numberProblem}
                {pdfAvailable}
                {pdfBusy}
                {onGeneratePdf}
                {onSetStatus}
                {onDelete}
                onFix={fix}
            />
        </div>
    </div>
</div>
