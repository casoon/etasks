<script lang="ts">
    import type {
        Client,
        Invoice,
        InvoiceLineItem,
        InvoiceStatus,
        ServiceItem,
        Task,
    } from "../domain/types";

    export let invoice: Invoice;
    export let clients: Client[] = [];
    export let services: ServiceItem[] = [];
    export let tasks: Task[] = [];
    export let projects: Array<{ id: string; name: string; clientId: string }> =
        [];
    export let appConfig: { profile?: { default_vat_rate?: number } } | null =
        null;
    export let blockedTaskIds: Set<string> = new Set();
    export let pdfAvailable = false;
    export let pdfBusy = false;
    export let onUpdate: (
        patch: Partial<Omit<Invoice, "id" | "createdAt">>,
    ) => void;
    export let onDelete: () => void;
    export let onGeneratePdf: () => void | Promise<void>;
    export let onMarkSent: () => void;
    export let onMarkPaid: () => void;

    let newItemInput = "";
    let showNewItemSuggestions = false;
    let taskPickerForLineItem: string | null = null;
    let lineItemDebounce: Record<string, ReturnType<typeof setTimeout>> = {};

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
    $: newItemSuggestions =
        newItemInput.trim().length >= 1
            ? services.filter((s) =>
                  s.name.toLowerCase().includes(newItemInput.toLowerCase()),
              )
            : [];
    $: invoiceTotals = calcTotals(invoice.lineItems);

    function calcTotals(lineItems: InvoiceLineItem[]) {
        const vatMap: Record<number, number> = {};
        let netto = 0;
        for (const li of lineItems) {
            const lineNetto = li.unitPrice * li.quantity;
            netto += lineNetto;
            if (!vatMap[li.vatRate]) vatMap[li.vatRate] = 0;
            vatMap[li.vatRate] += lineNetto;
        }
        const vatEntries = Object.entries(vatMap).map(([rate, base]) => ({
            rate: Number(rate),
            amount: base * (Number(rate) / 100),
        }));
        return {
            netto,
            vatEntries,
            total: netto + vatEntries.reduce((s, v) => s + v.amount, 0),
        };
    }

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
            clearTimeout(lineItemDebounce[key]);
            lineItemDebounce[key] = setTimeout(
                () =>
                    patchLineItem(lineItemId, {
                        [field]: val,
                    } as Partial<InvoiceLineItem>),
                400,
            );
        };
    }

    function onLineItemNum(lineItemId: string, field: keyof InvoiceLineItem) {
        return (e: Event) => {
            patchLineItem(lineItemId, {
                [field]:
                    parseFloat((e.currentTarget as HTMLInputElement).value) ||
                    0,
            } as Partial<InvoiceLineItem>);
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
        return (li.unitPrice * li.quantity).toFixed(2);
    }

    function handleClientChange(e: Event) {
        const clientId = (e.currentTarget as HTMLSelectElement).value;
        const client = clients.find((entry) => entry.id === clientId);
        onUpdate({
            clientId,
            customerNumber: client?.customerNumber ?? invoice.customerNumber,
        });
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
        onUpdate({
            status: (e.currentTarget as HTMLSelectElement)
                .value as InvoiceStatus,
        });
    }

    function handleNotesChange(e: Event) {
        onUpdate({ notes: (e.currentTarget as HTMLTextAreaElement).value });
    }
</script>

<div class="flex-1 overflow-y-auto flex flex-col">
    <div class="px-6 py-4 border-b border-border flex-shrink-0">
        <div class="flex items-center gap-2 flex-wrap">
            <select
                class="border border-border rounded-md px-2 py-[5px] text-[13px] bg-bg outline-none text-primary focus:border-accent flex-1 min-w-[160px]"
                value={invoice.clientId}
                on:change={handleClientChange}
            >
                <option value="">— Kein Kunde —</option>
                {#each clients as c (c.id)}<option value={c.id}>{c.name}</option
                    >{/each}
            </select>
            <input
                class="input font-mono w-[140px]"
                value={invoice.invoiceNumber}
                placeholder="RE-2026-001"
                on:input={handleInvoiceNumberChange}
            />
            <input
                class="input font-mono w-[120px]"
                value={invoice.customerNumber ?? ""}
                placeholder="Kunden-Nr."
                on:input={handleInvoiceMetaChange("customerNumber")}
            />
            <input
                class="input w-[130px]"
                type="date"
                value={invoice.date}
                on:input={handleDateChange("date")}
            />
            <input
                class="input w-[130px]"
                type="date"
                value={invoice.dueDate}
                on:input={handleDateChange("dueDate")}
            />
            <select
                class="border border-border rounded-md px-2 py-[5px] text-[12px] bg-bg outline-none text-secondary focus:border-accent"
                value={invoice.status}
                on:change={handleStatusChange}
            >
                <option value="draft">Entwurf</option>
                <option value="sent">Gesendet</option>
                <option value="paid">Bezahlt</option>
            </select>
            <button
                class="ml-auto rounded-xl border border-border bg-white/75 px-3 py-1.5 text-[12px] font-medium text-primary shadow-[0_1px_0_rgba(255,255,255,0.8)_inset] transition-colors hover:bg-white disabled:opacity-50"
                on:click={onGeneratePdf}
                disabled={!pdfAvailable || pdfBusy}
                title={!pdfAvailable
                    ? "Nur in der Desktop-App verfügbar"
                    : "PDF in Downloads erzeugen"}
            >
                {pdfBusy ? "PDF wird erstellt…" : "PDF erzeugen"}
            </button>
            {#if invoice.status === "draft"}
                <button
                    class="rounded-xl border border-border bg-white/75 px-3 py-1.5 text-[12px] font-medium text-primary transition-colors hover:bg-white"
                    on:click={onMarkSent}
                >
                    Als gesendet markieren
                </button>
            {/if}
            {#if invoice.status !== "paid"}
                <button
                    class="rounded-xl border border-green-200 bg-green-50 px-3 py-1.5 text-[12px] font-medium text-green-700 transition-colors hover:bg-green-100"
                    on:click={onMarkPaid}
                >
                    Als bezahlt markieren
                </button>
            {/if}
        </div>
        <p class="mt-2 text-[11px] text-muted">
            {#if pdfAvailable}
                PDF-Rechnungen werden in den Downloads-Ordner der Desktop-App
                geschrieben.
            {:else}
                PDF-Export ist im Browser deaktiviert.
            {/if}
        </p>
        <div class="mt-2 flex flex-wrap gap-2 text-[11px] text-muted">
            <span class="rounded-full bg-bg px-2 py-1"> 1. Daten pruefen </span>
            <span class="rounded-full bg-bg px-2 py-1"> 2. PDF erzeugen </span>
            <span class="rounded-full bg-bg px-2 py-1">
                3. Status auf gesendet / bezahlt setzen
            </span>
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

    <div class="px-6 py-4 flex flex-col gap-3">
        <h3
            class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted"
        >
            Positionen
        </h3>
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
                            step="0.5"
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
                                        >{t.estimatedMinutes ?? 0}m</span
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
                    >{invoiceTotals.netto.toFixed(2)} €</span
                >
            </div>
            {#each invoiceTotals.vatEntries as v (v.rate)}
                <div class="flex gap-8 text-[13px] text-secondary">
                    <span>MwSt. {v.rate} %</span>
                    <span class="tabular-nums w-[100px] text-right"
                        >{v.amount.toFixed(2)} €</span
                    >
                </div>
            {/each}
            <div
                class="flex gap-8 text-[15px] font-bold text-primary border-t border-border mt-1 pt-2"
            >
                <span>Gesamt</span>
                <span class="tabular-nums w-[100px] text-right"
                    >{invoiceTotals.total.toFixed(2)} €</span
                >
            </div>
        </div>
    {/if}

    <div
        class="px-6 py-4 border-t border-border-subtle flex-shrink-0 flex flex-col gap-2"
    >
        <p class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">
            Anmerkungen
        </p>
        <textarea
            class="w-full px-3 py-2 border border-border rounded-lg text-[13px] resize-y outline-none bg-bg text-primary focus:border-accent"
            value={invoice.notes ?? ""}
            placeholder="Interne Notizen oder zusätzlicher Rechnungstext..."
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
