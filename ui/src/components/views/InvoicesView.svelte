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
        $selectedInvoiceId as selectedInvoiceIdStore,
        updateInvoice,
        removeInvoice,
    } from "../../stores/invoiceStore";
    import {
        $appConfig as appConfigStore,
        missingPdfProfileFields,
        missingProfileMessage,
    } from "../../stores/configStore";
    import { toast } from "../../stores/toastStore";
        import { isTauriAvailable } from "../../lib/platform";
    import { generateInvoice, type InvoiceData } from "../../lib/invoiceService";
    import { isInvoiceNumberTaken } from "../../lib/invoiceNumber";
    import { createInvoiceDraft } from "../../lib/invoiceCreate";
    import {
        needsRevertConfirmation,
        statusBlockedReason,
    } from "../../lib/invoiceStatus";
    import { calcInvoiceTotals, fromCents, lineTotalCents } from "../../lib/invoiceMoney";
    import type { Invoice } from "../../domain/types";
    import InvoiceList from "../modals/InvoiceList.svelte";
    import InvoiceEditor from "../modals/InvoiceEditor.svelte";

    $: clients = [...$clientsStore];
    $: projects = [...$projectsStore];
    $: tasks = [...$tasksStore];
    $: services = [...$servicesStore];
    $: invoices = [...$invoicesStore];
    $: appConfig = $appConfigStore;
    $: missingProfileFields = appConfig ? missingPdfProfileFields(appConfig.profile) : [];

    let generatingPdf = false;

    $: selectedInvoiceId = $selectedInvoiceIdStore;
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
        creatingInvoice = true;
        await createInvoiceDraft();
        creatingInvoice = false;
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

<div class="flex-1 flex flex-col overflow-hidden">
    {#if !selectedInvoice}
        <InvoiceList
            {invoices}
            {clients}
            creating={creatingInvoice}
            onCreate={createNewInvoice}
            onSelect={(invoiceId) => selectedInvoiceIdStore.set(invoiceId)}
        />
    {:else}
        {#key selectedInvoice.id}
            <InvoiceEditor
                invoice={selectedInvoice}
                {clients}
                {services}
                {tasks}
                {projects}
                {appConfig}
                {missingProfileFields}
                billingItems={$billingItemsStore}
                unlockedBillingItemIds={$unlockedBillingItemIdsStore}
                timeEntries={$timeEntriesStore}
                termine={$termineStore}
                {blockedTaskIds}
                {otherInvoiceNumbers}
                pdfBusy={generatingPdf}
                pdfAvailable={isTauriAvailable()}
                onBack={() => selectedInvoiceIdStore.set(null)}
                onUpdate={updateSelectedInvoice}
                onDelete={deleteSelectedInvoice}
                onGeneratePdf={generateSelectedInvoicePdf}
                onSetStatus={setSelectedInvoiceStatus}
            />
        {/key}
    {/if}
</div>
