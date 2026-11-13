<!-- @module:projects -->
<script lang="ts">
    import {
        $clients as clientsStore,
        $projects as projectsStore,
    } from "../../stores/projectStore";
    import { $tasks as tasksStore } from "../../stores/taskStore";
    import { $timeEntries as timeEntriesStore } from "../../stores/timerStore";
    import { $termine as termineStore } from "../../stores/terminStore";
    import {
        $billingItems as billingItemsStore,
        $unlockedBillingItemIds as unlockedBillingItemIdsStore,
    } from "../../stores/billingStore";
    import { $services as servicesStore } from "../../stores/serviceStore";
    import {
        $invoices as invoicesStore,
        addInvoice,
        updateInvoice,
        removeInvoice,
    } from "../../stores/invoiceStore";
    import {
        $appConfig as appConfigStore,
        missingPdfProfileFields,
        missingProfileMessage,
    } from "../../stores/configStore";
    import { toast } from "../../stores/toastStore";
    import { today, toDateKey } from "../../domain/dateUtils";
    import { isTauriAvailable } from "../../lib/platform";
    import { generateInvoice, type InvoiceData } from "../../lib/invoiceService";
    import {
        allocateInvoiceNumber,
        isInvoiceNumberTaken,
    } from "../../lib/invoiceNumber";
    import {
        needsRevertConfirmation,
        statusBlockedReason,
    } from "../../lib/invoiceStatus";
    import { calcInvoiceTotals, fromCents, lineTotalCents } from "../../lib/invoiceMoney";
    import type { Invoice } from "../../domain/types";
    import { $navItem as navItemStore } from "../../stores/uiStore";
    import InvoiceList from "../modals/InvoiceList.svelte";
    import InvoiceEditor from "../modals/InvoiceEditor.svelte";

    $: clients = [...$clientsStore];
    $: projects = [...$projectsStore];
    $: tasks = [...$tasksStore];
    $: services = [...$servicesStore];
    $: invoices = [...$invoicesStore];
    $: appConfig = $appConfigStore;

    let generatingPdf = false;

    let selectedInvoiceId: string | null = null;
    $: selectedInvoice = selectedInvoiceId
        ? (invoices.find((i) => i.id === selectedInvoiceId) ?? null)
        : null;
    $: otherInvoiceNumbers = invoices
        .filter((i) => i.id !== selectedInvoiceId)
        .map((i) => i.invoiceNumber);
    $: blockedTaskIds = new Set(
        invoices
            .filter((i) => i.id !== selectedInvoiceId)
            .flatMap((i) => i.lineItems.flatMap((li) => li.taskIds)),
    );

    let creatingInvoice = false;

    async function createNewInvoice() {
        if (creatingInvoice) return;
        creatingInvoice = true;
        try {
            const config = appConfig;
            const prefix = config?.profile.invoice_number_prefix ?? "RE-";
            const dueDate = new Date();
            dueDate.setDate(
                dueDate.getDate() + (config?.profile.payment_days ?? 14),
            );

            const invoiceNumber = await allocateInvoiceNumber(
                prefix,
                config?.profile.invoice_number_counter,
                () => invoicesStore.get().map((i) => i.invoiceNumber),
            );
            const inv = addInvoice({
                clientId: "",
                invoiceNumber,
                customerNumber: "",
                date: today(),
                dueDate: toDateKey(dueDate),
                performancePeriod: "",
                projectReference: "",
                status: "draft",
                lineItems: [],
            });

            selectedInvoiceId = inv.id;
        } catch (error) {
            toast(
                `Rechnungsnummer konnte nicht vergeben werden: ${String(error)}`,
                "error",
                5000,
            );
        } finally {
            creatingInvoice = false;
        }
    }

    function updateSelectedInvoice(
        patch: Partial<Omit<Invoice, "id" | "createdAt">>,
    ) {
        if (!selectedInvoice) return;
        updateInvoice(selectedInvoice.id, patch);
    }

    function deleteSelectedInvoice() {
        if (!selectedInvoice) return;
        if (
            confirm(
                `Rechnung "${selectedInvoice.invoiceNumber}" wirklich löschen?`,
            )
        ) {
            removeInvoice(selectedInvoice.id);
            selectedInvoiceId = null;
        }
    }

    function setSelectedInvoiceStatus(status: Invoice["status"]) {
        if (!selectedInvoice || selectedInvoice.status === status) return;
        const blocked = statusBlockedReason(selectedInvoice, status);
        if (blocked) {
            toast(
                `Status „${status === "sent" ? "Gesendet" : "Bezahlt"}“ nicht möglich. ${blocked}`,
                "error",
                4000,
            );
            return;
        }
        if (
            needsRevertConfirmation(selectedInvoice.status, status) &&
            !confirm(
                `Rechnung "${selectedInvoice.invoiceNumber}" wieder auf „Entwurf“ setzen? Sie war bereits ${selectedInvoice.status === "paid" ? "bezahlt" : "gesendet"}.`,
            )
        ) {
            return;
        }
        updateInvoice(selectedInvoice.id, { status });
        toast(
            status === "sent"
                ? "Rechnung als gesendet markiert."
                : status === "paid"
                  ? "Rechnung als bezahlt markiert."
                  : "Rechnung wieder auf Entwurf gesetzt.",
            "success",
            3500,
        );
    }

    function splitClientAddress(address?: string) {
        const fallback = {
            street: "",
            house_number: "",
            postal_code: "",
            city: "",
            country: "Deutschland",
        };
        if (!address?.trim()) return fallback;

        const [firstLine, secondLine = ""] = address
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean);
        const streetMatch = firstLine.match(/^(.*?)(?:\s+(\d+[a-zA-Z/-]*))?$/);
        const locationMatch = secondLine.match(/^(\d{4,5})\s+(.+)$/);

        return {
            street: streetMatch?.[1]?.trim() ?? firstLine,
            house_number: streetMatch?.[2]?.trim() ?? "",
            postal_code: locationMatch?.[1] ?? "",
            city: locationMatch?.[2]?.trim() ?? secondLine,
            country: "Deutschland",
        };
    }

    async function generateSelectedInvoicePdf() {
        if (!selectedInvoice || !appConfig) return;
        if (!isTauriAvailable()) {
            toast(
                "PDF-Rechnungen sind nur in der Desktop-App verfügbar.",
                "info",
                4000,
            );
            return;
        }

        const client = clients.find(
            (entry) => entry.id === selectedInvoice.clientId,
        );
        if (!client) {
            toast("Für die Rechnung ist kein Kunde ausgewählt.", "error", 4500);
            return;
        }
        if (!client.address?.trim()) {
            toast(
                `Beim Kunden "${client.name}" fehlt die Rechnungsadresse.`,
                "error",
                4500,
            );
            return;
        }

        const profile = appConfig.profile;
        const missing = missingPdfProfileFields(profile);
        if (missing.length) {
            toast(missingProfileMessage(missing), "error", 7000);
            return;
        }
        if (!selectedInvoice.lineItems.length) {
            toast("Die Rechnung enthält noch keine Positionen.", "error", 4000);
            return;
        }
        if (
            !selectedInvoice.invoiceNumber.trim() ||
            isInvoiceNumberTaken(
                selectedInvoice.invoiceNumber,
                otherInvoiceNumbers,
            )
        ) {
            toast(
                "Die Rechnungsnummer fehlt oder ist bereits vergeben.",
                "error",
                4500,
            );
            return;
        }

        const invoicePayload: InvoiceData = {
            metadata: {
                invoice_number: selectedInvoice.invoiceNumber,
                invoice_date: { date: selectedInvoice.date },
                due_date: { date: selectedInvoice.dueDate },
                customer_number:
                    selectedInvoice.customerNumber?.trim() ||
                    client.customerNumber?.trim() ||
                    undefined,
                performance_period:
                    selectedInvoice.performancePeriod?.trim() || undefined,
                project_reference:
                    selectedInvoice.projectReference?.trim() || undefined,
                show_footer: true,
            },
            recipient: {
                name: client.contactPerson?.trim() || client.name,
                company: client.name,
                address: splitClientAddress(client.address),
            },
            salutation: {
                greeting: client.contactPerson?.trim()
                    ? `Hallo ${client.contactPerson.trim()},`
                    : `Hallo ${client.name},`,
                // Das Template druckt den Dankestext unter der Anrede; am Ende hat es keinen Platz dafür.
                introduction: profile.invoice_footer_text?.trim() || undefined,
            },
            items: selectedInvoice.lineItems.map((item, index) => {
                const total = fromCents(
                    lineTotalCents(item.unitPrice, item.quantity),
                );
                return {
                    position: index + 1,
                    description: item.description?.trim()
                        ? `${item.name}\n${item.description.trim()}`
                        : item.name,
                    quantity: item.quantity,
                    unit: item.unit,
                    vat_rate: { percentage: item.vatRate },
                    unit_price: { amount: item.unitPrice },
                    total: { amount: total },
                };
            }),
            totals: {
                subtotal: { amount: invoiceTotals.netto },
                vat_breakdown: invoiceTotals.vatEntries.map((entry) => ({
                    rate: { percentage: entry.rate },
                    base: { amount: entry.base },
                    amount: { amount: entry.amount },
                })),
                total: { amount: invoiceTotals.total },
            },
            payment: {
                due_date: { date: selectedInvoice.dueDate },
                bank_transfer_note: selectedInvoice.invoiceNumber,
            },
        };

        generatingPdf = true;
        try {
            const path = await generateInvoice(
                invoicePayload,
                appConfig,
                selectedInvoice.pdfPath,
            );
            updateInvoice(selectedInvoice.id, { pdfPath: path });
            toast(`PDF gespeichert: ${path}`, "success", 5500);
        } catch (error) {
            toast(
                `PDF-Erstellung fehlgeschlagen: ${String(error)}`,
                "error",
                5500,
            );
        } finally {
            generatingPdf = false;
        }
    }

    function calculateInvoiceTotals(invoice: Invoice | null) {
        const totals = calcInvoiceTotals(invoice?.lineItems ?? []);
        return {
            netto: fromCents(totals.nettoCents),
            vatEntries: totals.vatEntries.map((entry) => ({
                rate: entry.rate,
                base: fromCents(entry.baseCents),
                amount: fromCents(entry.amountCents),
            })),
            total: fromCents(totals.totalCents),
        };
    }

    $: invoiceTotals = calculateInvoiceTotals(selectedInvoice);
</script>

<div
    class="flex-1 grid overflow-hidden"
    style="grid-template-columns: 260px 1fr"
>
    <InvoiceList
        {invoices}
        {clients}
        {selectedInvoiceId}
        onCreate={createNewInvoice}
        onSelect={(invoiceId) => {
            selectedInvoiceId = invoiceId;
        }}
    />

    <div class="flex flex-col overflow-hidden">
        {#if !selectedInvoice}
            <div
                class="flex-1 flex flex-col items-center justify-center gap-5 text-center px-8"
            >
                {#if invoices.length === 0}
                    <div class="flex flex-col gap-2 max-w-xs">
                        <p class="text-[14px] font-semibold text-primary">Noch keine Rechnungen.</p>
                        <p class="text-[13px] text-muted leading-relaxed">Erstelle Rechnungen aus Kunden, Leistungen und erfasster Zeit.</p>
                    </div>
                    <div class="flex flex-col gap-2 w-full max-w-[200px]">
                        <button
                            class="px-4 py-2 rounded-lg bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity"
                            on:click={createNewInvoice}
                        >+ Erste Rechnung erstellen</button>
                        {#if clients.length === 0}
                            <button
                                class="px-4 py-1.5 rounded-lg border border-border text-[12px] text-secondary hover:bg-bg transition-colors"
                                on:click={() => navItemStore.set("clients")}
                            >Kunden anlegen</button>
                        {/if}
                        {#if services.length === 0}
                            <button
                                class="px-4 py-1.5 rounded-lg border border-border text-[12px] text-secondary hover:bg-bg transition-colors"
                                on:click={() => navItemStore.set("services")}
                            >Leistungen anlegen</button>
                        {/if}
                    </div>
                {:else}
                    <p class="text-muted text-[13px]">
                        Wähle eine Rechnung oder erstelle eine neue.
                    </p>
                    <button
                        class="px-4 py-2 rounded-lg bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity"
                        on:click={createNewInvoice}
                    >+ Neue Rechnung erstellen</button>
                {/if}
            </div>
        {:else}
            <InvoiceEditor
                invoice={selectedInvoice}
                {clients}
                {services}
                {tasks}
                {projects}
                {appConfig}
                billingItems={$billingItemsStore}
                unlockedBillingItemIds={$unlockedBillingItemIdsStore}
                timeEntries={$timeEntriesStore}
                termine={$termineStore}
                {blockedTaskIds}
                {otherInvoiceNumbers}
                pdfBusy={generatingPdf}
                pdfAvailable={isTauriAvailable()}
                onUpdate={updateSelectedInvoice}
                onDelete={deleteSelectedInvoice}
                onGeneratePdf={generateSelectedInvoicePdf}
                onSetStatus={setSelectedInvoiceStatus}
            />
        {/if}
    </div>
</div>