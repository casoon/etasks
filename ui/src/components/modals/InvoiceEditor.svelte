<!-- @module:billing -->
<script lang="ts">
    import { onDestroy } from "svelte";
    import type {
        BillingItem,
        Client,
        Invoice,
        InvoiceLineItem,
        InvoiceStatus,
        ServiceItem,
        Task,
        TimeEntry,
    } from "../../domain/types";
    import { formatTrackedTime, today } from "../../domain/dateUtils";

    import {
        calcInvoiceTotals,
        formatCents,
        isValidQuantity,
        isValidUnitPrice,
        isValidVatRate,
        lineTotalCents,
    } from "../../lib/invoiceMoney";
    import {
        billingItemToLineItem,
        minutesToQuarterHours,
        trackedTimeByProject,
        trackedTimeToLineItem,
    } from "../../lib/invoiceImport";
    import { isInvoiceNumberTaken } from "../../lib/invoiceNumber";
    import { statusBlockedReason } from "../../lib/invoiceStatus";
    import { toast } from "../../stores/toastStore";

    export let invoice: Invoice;
    export let clients: Client[] = [];
    export let services: ServiceItem[] = [];
    export let tasks: Task[] = [];
    export let projects: Array<{ id: string; name: string; clientId: string }> =
        [];
    export let appConfig: {
        profile?: {
            default_vat_rate?: number;
            invoice_number_prefix?: string;
            hourly_rate?: number;
        };
    } | null = null;
    export let billingItems: readonly BillingItem[] = [];
    export let unlockedBillingItemIds: readonly string[] = [];
    export let timeEntries: readonly TimeEntry[] = [];
    export let blockedTaskIds: Set<string> = new Set();
    export let otherInvoiceNumbers: string[] = [];
    export let pdfAvailable = false;
    export let pdfBusy = false;
    export let onUpdate: (
        patch: Partial<Omit<Invoice, "id" | "createdAt">>,
    ) => void;
    export let onDelete: () => void;
    export let onGeneratePdf: () => void | Promise<void>;
    export let onSetStatus: (status: InvoiceStatus) => void;

    let newItemInput = "";
    let showNewItemSuggestions = false;
    let taskPickerForLineItem: string | null = null;
    let importPanel: "project" | "time" | null = null;
    let timeFrom = today().slice(0, 8) + "01";
    let timeTo = today();
    // Pending text edits; flushed on blur (before another invoice is selected) and on destroy.
    const lineItemPending = new Map<string, { timer: ReturnType<typeof setTimeout>; run: () => void }>();

    function flushLineItemEdits() {
        for (const { timer, run } of [...lineItemPending.values()]) {
            clearTimeout(timer);
            run();
        }
    }
    onDestroy(flushLineItemEdits);

    $: clientTasksForInvoice = invoice.clientId
        ? tasks.filter(
              (t) =>
                  projects.find((p) => p.id === t.projectId)?.clientId ===
                  invoice.clientId,
          )
        : [];
    $: availableClientTasks = clientTasksForInvoice.filter(
        (t) => !blockedTaskIds.has(t.id),
    );
    $: client = clients.find((c) => c.id === invoice.clientId);
    $: vatDefault = appConfig?.profile?.default_vat_rate ?? 19;
    $: clientBillingItems = invoice.clientId
        ? billingItems
              .filter(
                  (i) =>
                      projects.find((p) => p.id === i.projectId)?.clientId ===
                      invoice.clientId,
              )
              .map((i) => ({ item: i, ready: unlockedBillingItemIds.includes(i.id) }))
              .sort((a, b) => Number(b.ready) - Number(a.ready))
        : [];
    $: hourlyRate = client?.hourlyRate ?? appConfig?.profile?.hourly_rate;
    $: hourlyRateSource =
        client?.hourlyRate != null ? "Kunde" : "Profil";
    $: trackedRows = invoice.clientId
        ? trackedTimeByProject(
              timeEntries,
              (taskId) => tasks.find((t) => t.id === taskId)?.projectId,
              projects,
              invoice.clientId,
              timeFrom,
              timeTo,
          )
        : [];
    $: newItemSuggestions =
        newItemInput.trim().length >= 1
            ? services.filter((s) =>
                  s.name.toLowerCase().includes(newItemInput.toLowerCase()),
              )
            : [];
    $: invoiceTotals = calcInvoiceTotals(invoice.lineItems);
    $: numberProblem = !invoice.invoiceNumber.trim()
        ? "Bitte eine Rechnungsnummer angeben."
        : isInvoiceNumberTaken(invoice.invoiceNumber, otherInvoiceNumbers)
          ? "Diese Rechnungsnummer ist bereits vergeben."
          : "";
    $: sendBlockedReason = numberProblem || statusBlockedReason(invoice, "sent");
    $: paidBlockedReason = statusBlockedReason(invoice, "paid");

    function patchLineItem(
        lineItemId: string,
        patch: Partial<InvoiceLineItem>,
    ) {
        onUpdate({
            lineItems: invoice.lineItems.map((li) =>
                li.id === lineItemId ? { ...li, ...patch } : li,
            ),
        });
    }

    function onLineItemStr(lineItemId: string, field: keyof InvoiceLineItem) {
        return (e: Event) => {
            const val = (
                e.currentTarget as HTMLInputElement | HTMLTextAreaElement
            ).value;
            const key = lineItemId + ":" + String(field);
            clearTimeout(lineItemPending.get(key)?.timer);
            const run = () => {
                lineItemPending.delete(key);
                patchLineItem(lineItemId, {
                    [field]: val,
                } as Partial<InvoiceLineItem>);
            };
            lineItemPending.set(key, { timer: setTimeout(run, 400), run });
        };
    }

    const lineItemNumRules: Record<
        "unitPrice" | "quantity" | "vatRate",
        { valid: (value: number) => boolean; message: string }
    > = {
        unitPrice: {
            valid: isValidUnitPrice,
            message: "Der Einzelpreis darf nicht negativ sein.",
        },
        quantity: {
            valid: isValidQuantity,
            message: "Die Menge muss größer als 0 sein.",
        },
        vatRate: {
            valid: isValidVatRate,
            message: "Die MwSt. muss zwischen 0 und 100 % liegen.",
        },
    };

    function onLineItemNum(
        lineItemId: string,
        field: "unitPrice" | "quantity" | "vatRate",
    ) {
        return (e: Event) => {
            const input = e.currentTarget as HTMLInputElement;
            const value = parseFloat(input.value);
            const rule = lineItemNumRules[field];
            if (!rule.valid(value)) {
                input.value = String(
                    invoice.lineItems.find((li) => li.id === lineItemId)?.[
                        field
                    ] ?? "",
                );
                toast(rule.message, "error", 3500);
                return;
            }
            patchLineItem(lineItemId, { [field]: value });
        };
    }

    function addFreeTextLineItem() {
        if (!newItemInput.trim()) return;
        const item: InvoiceLineItem = {
            id: crypto.randomUUID(),
            name: newItemInput.trim(),
            description: "",
            unit: "Stunde",
            unitPrice: 0,
            quantity: 1,
            vatRate: appConfig?.profile?.default_vat_rate ?? 19,
            taskIds: [],
        };
        onUpdate({ lineItems: [...invoice.lineItems, item] });
        newItemInput = "";
        showNewItemSuggestions = false;
    }

    function addCatalogLineItem(svc: ServiceItem) {
        const item: InvoiceLineItem = {
            id: crypto.randomUUID(),
            serviceItemId: svc.id,
            name: svc.name,
            description: svc.description,
            unit: svc.unit,
            unitPrice: svc.unitPrice,
            quantity: 1,
            vatRate: svc.vatRate,
            taskIds: [],
        };
        onUpdate({ lineItems: [...invoice.lineItems, item] });
        newItemInput = "";
        showNewItemSuggestions = false;
    }

    function addBillingItemLine(item: BillingItem) {
        onUpdate({
            lineItems: [
                ...invoice.lineItems,
                billingItemToLineItem(item, vatDefault),
            ],
        });
    }

    function addTrackedTimeLine(row: (typeof trackedRows)[number]) {
        onUpdate({
            lineItems: [
                ...invoice.lineItems,
                trackedTimeToLineItem(
                    row,
                    hourlyRate ?? 0,
                    vatDefault,
                    timeFrom,
                    timeTo,
                ),
            ],
        });
    }

    function formatHours(hours: number) {
        return hours.toLocaleString("de-DE", { maximumFractionDigits: 2 });
    }

    function removeLineItem(lineItemId: string) {
        onUpdate({
            lineItems: invoice.lineItems.filter((li) => li.id !== lineItemId),
        });
        if (taskPickerForLineItem === lineItemId) taskPickerForLineItem = null;
    }

    function assignTaskToLineItem(taskId: string, lineItemId: string) {
        onUpdate({
            lineItems: invoice.lineItems.map((li) => {
                if (li.id === lineItemId)
                    return {
                        ...li,
                        taskIds: [
                            ...li.taskIds.filter((id) => id !== taskId),
                            taskId,
                        ],
                    };
                return {
                    ...li,
                    taskIds: li.taskIds.filter((id) => id !== taskId),
                };
            }),
        });
        taskPickerForLineItem = null;
    }

    function removeTaskFromLineItem(taskId: string, lineItemId: string) {
        patchLineItem(lineItemId, {
            taskIds: (
                invoice.lineItems.find((li) => li.id === lineItemId)?.taskIds ??
                []
            ).filter((id) => id !== taskId),
        });
    }

    function getTaskById(id: string) {
        return tasks.find((t) => t.id === id);
    }

    function getProjectName(projectId?: string) {
        return projectId
            ? (projects.find((p) => p.id === projectId)?.name ?? "")
            : "";
    }

    function lineItemTotal(li: InvoiceLineItem) {
        return formatCents(lineTotalCents(li.unitPrice, li.quantity));
    }

    function handleClientChange(e: Event) {
        const clientId = (e.currentTarget as HTMLSelectElement).value;
        const client = clients.find((entry) => entry.id === clientId);
        onUpdate({
            clientId,
            customerNumber: client?.customerNumber ?? "",
            // Aufgaben gehören zum bisherigen Kunden und würden sonst auf der neuen Rechnung hängen bleiben.
            lineItems: invoice.lineItems.map((li) => ({ ...li, taskIds: [] })),
        });
        taskPickerForLineItem = null;
    }

    function handleInvoiceNumberChange(e: Event) {
        onUpdate({
            invoiceNumber: (e.currentTarget as HTMLInputElement).value,
        });
    }

    function handleInvoiceMetaChange(
        field: "customerNumber" | "performancePeriod" | "projectReference",
    ) {
        return (e: Event) => {
            onUpdate({ [field]: (e.currentTarget as HTMLInputElement).value });
        };
    }

    function handleDateChange(field: "date" | "dueDate") {
        return (e: Event) => {
            onUpdate({ [field]: (e.currentTarget as HTMLInputElement).value });
        };
    }

    function handleStatusChange(e: Event) {
        const select = e.currentTarget as HTMLSelectElement;
        onSetStatus(select.value as InvoiceStatus);
        // Bei abgelehntem Wechsel zeigt das Dropdown weiter den echten Status.
        select.value = invoice.status;
    }

    function handleNotesChange(e: Event) {
        onUpdate({ notes: (e.currentTarget as HTMLTextAreaElement).value });
    }
</script>

<div class="flex-1 overflow-y-auto flex flex-col">
    <div class="px-6 py-4 border-b border-border flex-shrink-0">
        <div class="flex items-end gap-2 flex-wrap">
            <label class="flex flex-col gap-1 flex-1 min-w-[160px]">
                <span class="text-[10px] uppercase tracking-wide text-muted"
                    >Kunde</span
                >
                <select
                    class="border border-border rounded-md px-2 py-[5px] text-[13px] bg-bg outline-none text-primary focus:border-accent"
                    value={invoice.clientId}
                    on:change={handleClientChange}
                >
                    <option value="">— Kein Kunde —</option>
                    {#each clients as c (c.id)}<option value={c.id}
                            >{c.name}</option
                        >{/each}
                </select>
            </label>
            <label class="flex flex-col gap-1 w-[140px]">
                <span class="text-[10px] uppercase tracking-wide text-muted"
                    >Rechnungsnummer</span
                >
                <input
                    class="input font-mono"
                    class:border-red-500={Boolean(numberProblem)}
                    value={invoice.invoiceNumber}
                    placeholder={`${appConfig?.profile?.invoice_number_prefix?.trim() || "RE-"}001`}
                    on:input={handleInvoiceNumberChange}
                />
            </label>
            <label class="flex flex-col gap-1 w-[120px]">
                <span class="text-[10px] uppercase tracking-wide text-muted"
                    >Kundennummer</span
                >
                <input
                    class="input font-mono"
                    value={invoice.customerNumber ?? ""}
                    placeholder="Kunden-Nr."
                    on:input={handleInvoiceMetaChange("customerNumber")}
                />
            </label>
            <label class="flex flex-col gap-1 w-[130px]">
                <span class="text-[10px] uppercase tracking-wide text-muted"
                    >Rechnungsdatum</span
                >
                <input
                    class="input"
                    type="date"
                    value={invoice.date}
                    on:input={handleDateChange("date")}
                />
            </label>
            <label class="flex flex-col gap-1 w-[130px]">
                <span class="text-[10px] uppercase tracking-wide text-muted"
                    >Fällig am</span
                >
                <input
                    class="input"
                    type="date"
                    value={invoice.dueDate}
                    on:input={handleDateChange("dueDate")}
                />
            </label>
            <select
                class="border border-border rounded-md px-2 py-[5px] text-[12px] bg-bg outline-none text-secondary focus:border-accent"
                value={invoice.status}
                on:change={handleStatusChange}
            >
                <option value="draft">Entwurf</option>
                <option
                    value="sent"
                    disabled={Boolean(sendBlockedReason) &&
                        invoice.status !== "sent"}>Gesendet</option
                >
                <option
                    value="paid"
                    disabled={Boolean(paidBlockedReason) &&
                        invoice.status !== "paid"}>Bezahlt</option
                >
            </select>
            <button
                class="ml-auto rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-primary transition-colors hover:bg-bg disabled:opacity-50"
                on:click={onGeneratePdf}
                disabled={!pdfAvailable || pdfBusy || Boolean(numberProblem)}
                title={!pdfAvailable
                    ? "Nur in der Desktop-App verfügbar"
                    : numberProblem || "PDF im Standard-Exportordner erzeugen"}
            >
                {pdfBusy ? "PDF wird erstellt…" : "PDF erzeugen"}
            </button>
            {#if invoice.status === "draft"}
                <button
                    class="rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-primary transition-colors hover:bg-bg disabled:opacity-50"
                    on:click={() => onSetStatus("sent")}
                    disabled={Boolean(sendBlockedReason)}
                    title={sendBlockedReason}
                >
                    Als gesendet markieren
                </button>
            {/if}
            {#if invoice.status !== "paid"}
                <button
                    class="rounded-xl border border-green-200 bg-green-50 px-3 py-1.5 text-[12px] font-medium text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
                    on:click={() => onSetStatus("paid")}
                    disabled={Boolean(paidBlockedReason)}
                    title={paidBlockedReason}
                >
                    Als bezahlt markieren
                </button>
            {/if}
        </div>
        {#if numberProblem}
            <p class="mt-2 text-[11px] text-red-500">{numberProblem}</p>
        {/if}
        {#if invoice.status === "draft" && sendBlockedReason && !numberProblem}
            <p class="mt-2 text-[11px] text-muted">
                „Als gesendet markieren“ ist noch nicht möglich. {sendBlockedReason}
            </p>
        {/if}
        {#if invoice.status !== "draft"}
            <p class="mt-2 text-[11px] text-muted">
                Diese Rechnung ist bereits {invoice.status === "paid" ? "bezahlt" : "gesendet"}.
                Änderungen an Nummer oder Datum stimmen dann nicht mehr mit dem ausgestellten Dokument überein.
            </p>
        {/if}
        <p class="mt-2 text-[11px] text-muted">
            {#if pdfAvailable}
                PDF-Rechnungen werden im Standard-Exportordner der Desktop-App
                gespeichert.
            {:else}
                PDF-Export ist im Browser deaktiviert.
            {/if}
        </p>
        <div class="mt-2 flex flex-wrap gap-2 text-[11px] text-muted">
            <span class="rounded-full border border-border bg-surface px-2 py-1">1. Daten prüfen</span>
            <span class="rounded-full border border-border bg-surface px-2 py-1">2. PDF erzeugen</span>
            <span class="rounded-full border border-border bg-surface px-2 py-1">3. Als gesendet markieren</span>
        </div>
        <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            <label class="flex flex-col gap-1">
                <span class="text-[10px] uppercase tracking-wide text-muted">
                    Leistungszeitraum
                </span>
                <input
                    class="input text-[12px]"
                    value={invoice.performancePeriod ?? ""}
                    placeholder="z. B. 03-12/2025"
                    on:input={handleInvoiceMetaChange("performancePeriod")}
                />
            </label>
            <label class="flex flex-col gap-1">
                <span class="text-[10px] uppercase tracking-wide text-muted">
                    Projektbezug
                </span>
                <input
                    class="input text-[12px]"
                    value={invoice.projectReference ?? ""}
                    placeholder="z. B. P240001 Andersch Liebthal"
                    on:input={handleInvoiceMetaChange("projectReference")}
                />
            </label>
        </div>
    </div>

    <div class="px-6 py-4 flex flex-col gap-3" on:focusout={flushLineItemEdits}>
        <div class="flex items-center gap-2 flex-wrap">
            <h3
                class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted mr-auto"
            >
                Positionen
            </h3>
            <button
                class="px-2 py-[2px] rounded-full border border-dashed border-border text-[11px] text-muted hover:text-primary hover:border-accent transition-colors disabled:opacity-50"
                disabled={!invoice.clientId}
                title={invoice.clientId ? "" : "Wähle zuerst einen Kunden."}
                on:click={() =>
                    (importPanel = importPanel === "project" ? null : "project")}
                >Aus Projekt übernehmen</button
            >
            <button
                class="px-2 py-[2px] rounded-full border border-dashed border-border text-[11px] text-muted hover:text-primary hover:border-accent transition-colors disabled:opacity-50"
                disabled={!invoice.clientId}
                title={invoice.clientId ? "" : "Wähle zuerst einen Kunden."}
                on:click={() =>
                    (importPanel = importPanel === "time" ? null : "time")}
                >Erfasste Zeit übernehmen</button
            >
        </div>
        {#if importPanel === "project"}
            <div class="border border-border rounded-lg bg-bg overflow-hidden">
                {#if clientBillingItems.length === 0}
                    <p class="text-[12px] text-muted px-3 py-2">
                        Keine Projekt-Positionen für diesen Kunden.
                    </p>
                {/if}
                {#each clientBillingItems as { item, ready } (item.id)}
                    <button
                        class="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface text-left border-b border-border last:border-b-0 transition-colors"
                        on:click={() => addBillingItemLine(item)}
                    >
                        <span class="flex-1 text-[12px] text-primary">{item.title}</span>
                        {#if ready}
                            <span class="text-[10px] px-[6px] py-[1px] rounded-full bg-green-100 text-green-700">✓ Abrechenbar</span>
                        {/if}
                        <span class="text-[11px] text-muted">{projects.find((p) => p.id === item.projectId)?.name ?? ""}</span>
                        <span class="text-[11px] text-muted tabular-nums">{((item.unitPriceCents ?? 0) / 100).toFixed(2)} €</span>
                    </button>
                {/each}
                <button
                    class="w-full text-[11px] text-muted text-center py-2 hover:bg-surface border-t border-border"
                    on:click={() => (importPanel = null)}>Schließen</button
                >
            </div>
        {:else if importPanel === "time"}
            <div class="border border-border rounded-lg bg-bg overflow-hidden">
                <div class="flex items-end gap-2 flex-wrap px-3 py-2 border-b border-border">
                    <label class="flex flex-col gap-1 w-[130px]">
                        <span class="text-[10px] uppercase tracking-wide text-muted">Von</span>
                        <input class="input" type="date" lang="de" bind:value={timeFrom} />
                    </label>
                    <label class="flex flex-col gap-1 w-[130px]">
                        <span class="text-[10px] uppercase tracking-wide text-muted">Bis</span>
                        <input class="input" type="date" lang="de" bind:value={timeTo} />
                    </label>
                    <p class="text-[11px] text-muted flex-1 min-w-[160px]">
                        {#if hourlyRate != null}
                            Stundensatz {hourlyRate.toFixed(2)} € ({hourlyRateSource}). Zeit wird auf Viertelstunden gerundet.
                        {:else}
                            Kein Stundensatz hinterlegt (weder beim Kunden noch im Profil); der Preis wird mit 0 € eingetragen.
                        {/if}
                    </p>
                </div>
                {#if trackedRows.length === 0}
                    <p class="text-[12px] text-muted px-3 py-2">
                        Keine erfasste Zeit für diesen Kunden im Zeitraum.
                    </p>
                {/if}
                {#each trackedRows as row (row.projectId)}
                    <button
                        class="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface text-left border-b border-border last:border-b-0 transition-colors"
                        title={row.tasks.map((t) => `${getTaskById(t.taskId)?.title ?? "Aufgabe"}: ${formatTrackedTime(t.minutes * 60)}`).join("\n")}
                        on:click={() => addTrackedTimeLine(row)}
                    >
                        <span class="flex-1 text-[12px] text-primary">{row.projectName}</span>
                        <span class="text-[11px] text-muted tabular-nums">{formatTrackedTime(row.minutes * 60)} erfasst</span>
                        <span class="text-[11px] text-primary tabular-nums">{formatHours(minutesToQuarterHours(row.minutes))} h</span>
                    </button>
                {/each}
                <button
                    class="w-full text-[11px] text-muted text-center py-2 hover:bg-surface border-t border-border"
                    on:click={() => (importPanel = null)}>Schließen</button
                >
            </div>
        {/if}
        {#each invoice.lineItems as li (li.id)}
            <div
                class="flex flex-col gap-2 p-3 rounded-xl border border-border bg-surface"
            >
                <div class="flex items-center gap-2">
                    {#if li.serviceItemId}
                        <div class="flex items-center gap-2 flex-1 min-w-0">
                            <span
                                class="text-[10px] text-accent font-medium px-[6px] py-[1px] rounded-full bg-accent-subtle flex-shrink-0"
                                >🔒 Katalog</span
                            >
                            <span
                                class="text-[13px] font-medium text-primary overflow-hidden text-ellipsis whitespace-nowrap"
                                >{li.name}</span
                            >
                        </div>
                    {:else}
                        <input
                            class="input flex-1 min-w-0"
                            value={li.name}
                            placeholder="Bezeichnung"
                            on:input={onLineItemStr(li.id, "name")}
                        />
                    {/if}
                    <span
                        class="text-[13px] font-semibold text-primary tabular-nums flex-shrink-0"
                        >{lineItemTotal(li)} €</span
                    >
                    <button
                        class="w-6 h-6 flex items-center justify-center rounded text-muted hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0 text-sm"
                        on:click={() => removeLineItem(li.id)}>×</button
                    >
                </div>
                <input
                    class="input text-[12px]"
                    value={li.description}
                    placeholder="Rechnungstext / Beschreibung (optional)"
                    on:input={onLineItemStr(li.id, "description")}
                />
                <div class="grid grid-cols-4 gap-2">
                    <label class="flex flex-col gap-1"
                        ><span
                            class="text-[10px] text-muted font-medium uppercase tracking-wide"
                            >Einheit</span
                        ><input
                            class="input text-[12px]"
                            value={li.unit}
                            placeholder="Stunde"
                            on:input={onLineItemStr(li.id, "unit")}
                        /></label
                    >
                    <label class="flex flex-col gap-1"
                        ><span
                            class="text-[10px] text-muted font-medium uppercase tracking-wide"
                            >Einzelpreis (€)</span
                        ><input
                            class="input text-[12px] tabular-nums"
                            type="number"
                            step="0.01"
                            min="0"
                            value={li.unitPrice}
                            on:change={onLineItemNum(li.id, "unitPrice")}
                        /></label
                    >
                    <label class="flex flex-col gap-1"
                        ><span
                            class="text-[10px] text-muted font-medium uppercase tracking-wide"
                            >Menge</span
                        ><input
                            class="input text-[12px] tabular-nums"
                            type="number"
                            step="any"
                            min="0"
                            value={li.quantity}
                            on:change={onLineItemNum(li.id, "quantity")}
                        /></label
                    >
                    <label class="flex flex-col gap-1"
                        ><span
                            class="text-[10px] text-muted font-medium uppercase tracking-wide"
                            >MwSt. %</span
                        ><input
                            class="input text-[12px] tabular-nums"
                            type="number"
                            min="0"
                            max="100"
                            value={li.vatRate}
                            on:change={onLineItemNum(li.id, "vatRate")}
                        /></label
                    >
                </div>
                <div class="flex items-center gap-2 flex-wrap">
                    <span
                        class="text-[10px] text-muted font-medium uppercase tracking-wide"
                        >Aufgaben:</span
                    >
                    {#each li.taskIds as taskId (taskId)}
                        {@const t = getTaskById(taskId)}
                        {#if t}
                            <span
                                class="flex items-center gap-1 px-2 py-[2px] rounded-full bg-bg border border-border text-[11px] text-secondary"
                            >
                                {t.title}
                                <button
                                    class="text-muted hover:text-red-500 ml-1 leading-none"
                                    on:click={() =>
                                        removeTaskFromLineItem(taskId, li.id)}
                                    >×</button
                                >
                            </span>
                        {/if}
                    {/each}
                    {#if invoice.clientId}
                        <button
                            class="px-2 py-[2px] rounded-full border border-dashed border-border text-[11px] text-muted hover:text-primary hover:border-accent transition-colors"
                            on:click={() => {
                                taskPickerForLineItem =
                                    taskPickerForLineItem === li.id
                                        ? null
                                        : li.id;
                            }}>+ Aufgabe</button
                        >
                    {/if}
                </div>
                {#if taskPickerForLineItem === li.id}
                    <div
                        class="border border-border rounded-lg bg-bg overflow-hidden"
                    >
                        {#if availableClientTasks.length === 0}
                            <p class="text-[12px] text-muted px-3 py-2">
                                Keine verfügbaren Aufgaben für diesen Kunden.
                            </p>
                        {:else}
                            {#each availableClientTasks as t (t.id)}
                                <button
                                    class="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface text-left border-b border-border last:border-b-0 transition-colors"
                                    on:click={() =>
                                        assignTaskToLineItem(t.id, li.id)}
                                >
                                    <span
                                        class="flex-1 text-[12px] text-primary"
                                        >{t.title}</span
                                    >
                                    <span class="text-[11px] text-muted"
                                        >{getProjectName(t.projectId)}</span
                                    >
                                    <span
                                        class="text-[11px] text-muted tabular-nums"
                                        >{t.trackedSeconds
                                            ? formatTrackedTime(t.trackedSeconds)
                                            : "–"}</span
                                    >
                                </button>
                            {/each}
                        {/if}
                        <button
                            class="w-full text-[11px] text-muted text-center py-2 hover:bg-surface border-t border-border"
                            on:click={() => (taskPickerForLineItem = null)}
                            >Schließen</button
                        >
                    </div>
                {/if}
            </div>
        {/each}

        <div class="relative">
            <div
                class="flex items-center gap-2 border border-dashed border-border rounded-xl px-3 py-2 focus-within:border-accent transition-colors"
            >
                <input
                    class="flex-1 text-[13px] outline-none bg-transparent text-primary"
                    placeholder="+ Neue Position — Katalogsuche oder Freitext (Enter)"
                    bind:value={newItemInput}
                    on:focus={() => {
                        showNewItemSuggestions = true;
                    }}
                    on:blur={() =>
                        setTimeout(() => {
                            showNewItemSuggestions = false;
                        }, 150)}
                    on:keydown={(e) => {
                        if (e.key === "Enter") addFreeTextLineItem();
                        if (e.key === "Escape") newItemInput = "";
                    }}
                />
                {#if newItemInput.trim()}
                    <button
                        class="text-[12px] text-accent hover:underline flex-shrink-0"
                        on:mousedown|preventDefault={addFreeTextLineItem}
                        >Als Freitext</button
                    >
                {/if}
            </div>
            {#if showNewItemSuggestions && newItemSuggestions.length > 0}
                <div
                    class="absolute left-0 right-0 top-full z-10 bg-surface border border-border rounded-xl shadow-lg mt-1 overflow-hidden"
                >
                    {#each newItemSuggestions as svc (svc.id)}
                        <button
                            class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-bg text-left border-b border-border last:border-b-0 transition-colors"
                            on:mousedown|preventDefault={() =>
                                addCatalogLineItem(svc)}
                        >
                            <div class="flex-1 min-w-0">
                                <p class="text-[13px] font-medium text-primary">
                                    {svc.name}
                                </p>
                                {#if svc.description}<p
                                        class="text-[11px] text-muted truncate"
                                    >
                                        {svc.description}
                                    </p>{/if}
                            </div>
                            <span
                                class="text-[12px] text-muted flex-shrink-0 tabular-nums"
                                >{svc.unitPrice.toFixed(2)} €/{svc.unit}</span
                            >
                        </button>
                    {/each}
                </div>
            {/if}
        </div>
    </div>

    {#if invoiceTotals && invoice.lineItems.length > 0}
        <div
            class="px-6 py-4 border-t border-border-subtle flex-shrink-0 flex flex-col gap-1 items-end"
        >
            <div class="flex gap-8 text-[13px] text-secondary">
                <span>Netto</span>
                <span class="tabular-nums w-[100px] text-right"
                    >{formatCents(invoiceTotals.nettoCents)} €</span
                >
            </div>
            {#each invoiceTotals.vatEntries as v (v.rate)}
                <div class="flex gap-8 text-[13px] text-secondary">
                    <span>MwSt. {v.rate} %</span>
                    <span class="tabular-nums w-[100px] text-right"
                        >{formatCents(v.amountCents)} €</span
                    >
                </div>
            {/each}
            <div
                class="flex gap-8 text-[15px] font-bold text-primary border-t border-border mt-1 pt-2"
            >
                <span>Gesamt</span>
                <span class="tabular-nums w-[100px] text-right"
                    >{formatCents(invoiceTotals.totalCents)} €</span
                >
            </div>
        </div>
    {/if}

    <div
        class="px-6 py-4 border-t border-border-subtle flex-shrink-0 flex flex-col gap-2"
    >
        <p class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">
            Anmerkungen (intern)
        </p>
        <textarea
            class="w-full px-3 py-2 border border-border rounded-lg text-[13px] resize-y outline-none bg-bg text-primary focus:border-accent"
            value={invoice.notes ?? ""}
            placeholder="Interne Notizen (werden nicht auf die Rechnung gedruckt)..."
            rows={2}
            on:input={handleNotesChange}
        />
    </div>

    <div class="px-6 py-4 border-t border-border-subtle flex-shrink-0">
        <button
            class="px-3 py-1 text-red-500 border border-red-200 rounded-lg text-[12px] hover:bg-red-50 transition-colors"
            on:click={onDelete}>Rechnung löschen</button
        >
    </div>
</div>

<style>
    .input {
        width: 100%;
        padding: 6px 10px;
        background: var(--color-bg);
        border: 1px solid var(--color-border);
        border-radius: 6px;
        color: var(--color-text-primary);
        font-size: 13px;
        outline: none;
        transition: border-color 0.15s;
    }
    .input:focus {
        border-color: var(--color-accent);
    }
</style>
