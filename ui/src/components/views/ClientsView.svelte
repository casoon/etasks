<!-- @module:projects -->
<script lang="ts">
    import {
        $clients as clientsStore,
        $projects as projectsStore,
    } from "../../stores/projectStore";
    import { $tasks as tasksStore } from "../../stores/taskStore";
    import { $services as servicesStore } from "../../stores/serviceStore";
    import {
        $invoices as invoicesStore,
        addInvoice,
        updateInvoice,
        removeInvoice,
    } from "../../stores/invoiceStore";
    import { $appConfig as appConfigStore } from "../../stores/configStore";
    import { toast } from "../../stores/toastStore";
    import { today, toDateKey } from "../../domain/dateUtils";
    import { isTauriAvailable } from "../../lib/platform";
    import { generateInvoice, type InvoiceData } from "../../lib/invoiceService";
    import {
        allocateInvoiceNumber,
        isInvoiceNumberTaken,
    } from "../../lib/invoiceNumber";
    import { calcInvoiceTotals, fromCents, lineTotalCents } from "../../lib/invoiceMoney";
    import type { Invoice } from "../../domain/types";
    import ClientManager from "../modals/ClientManager.svelte";
    import ServiceCatalog from "../modals/ServiceCatalog.svelte";
    import InvoiceList from "../modals/InvoiceList.svelte";
    import InvoiceEditor from "../modals/InvoiceEditor.svelte";

    $: clients = [...$clientsStore];
    $: projects = [...$projectsStore];
    $: tasks = [...$tasksStore];
    $: services = [...$servicesStore];
    $: invoices = [...$invoicesStore];
    $: appConfig = $appConfigStore;

    type RightView = "invoice" | "clients" | "services";
    let rightView: RightView = "invoice";
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
            rightView = "invoice";
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

    function markSelectedInvoiceStatus(status: Invoice["status"]) {
        if (!selectedInvoice) return;
        if (
            status === "sent" &&
            (!selectedInvoice.clientId || !selectedInvoice.lineItems.length)
        ) {
            toast(
                "Zum Senden braucht die Rechnung einen Kunden und mindestens eine Position.",
                "error",
                4000,
            );
            return;
        }
        updateInvoice(selectedInvoice.id, { status });
        toast(
            status === "sent"
                ? "Rechnung als gesendet markiert."
                : "Rechnung als bezahlt markiert.",
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
        const clientProjects = projects.filter(
            (project) => project.clientId === selectedInvoice.clientId,
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
        if (
            !profile.company.trim() ||
            !profile.first_name.trim() ||
            !profile.last_name.trim() ||
            !profile.street.trim() ||
            !profile.zip.trim() ||
            !profile.city.trim()
        ) {
            toast(
                "Im Profil fehlen noch Firmen- oder Adressdaten für die PDF-Rechnung.",
                "error",
                5000,
            );
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
                    selectedInvoice.projectReference?.trim() ||
                    clientProjects[0]?.name ||
                    undefined,
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
            updateInvoice(selectedInvoice.id, {
                pdfPath: path,
                ...(selectedInvoice.status === "draft"
                    ? { status: "sent" as const }
                    : {}),
            });
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
            rightView = "invoice";
        }}
    />

    <div class="flex flex-col overflow-hidden">
        <div
            class="flex items-center justify-between px-4 border-b border-border flex-shrink-0 h-[52px] bg-white/55 backdrop-blur-xl"
        >
            {#if rightView !== "invoice"}
                <button
                    class="flex items-center gap-1 text-[13px] text-secondary hover:text-primary transition-colors"
                    on:click={() => (rightView = "invoice")}
                    >← Rechnungen</button
                >
            {:else}
                <div />
            {/if}
            <div
                class="flex gap-1 rounded-xl border border-border bg-white/70 p-1 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset]"
            >
                <button
                    class="px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors {rightView ===
                    'clients'
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-secondary hover:bg-white/80 hover:text-primary'}"
                    on:click={() => (rightView = "clients")}>Kunden</button
                >
                <button
                    class="px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors {rightView ===
                    'services'
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-secondary hover:bg-white/80 hover:text-primary'}"
                    on:click={() => (rightView = "services")}>Leistungen</button
                >
            </div>
        </div>

        {#if rightView === "clients"}
            <ClientManager
                emptyProjectsMessage="Noch keine Projekte für diesen Kunden."
            />
        {:else if rightView === "services"}
            <ServiceCatalog />
        {:else if !selectedInvoice}
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
                                on:click={() => (rightView = "clients")}
                            >Kunden anlegen</button>
                        {/if}
                        {#if services.length === 0}
                            <button
                                class="px-4 py-1.5 rounded-lg border border-border text-[12px] text-secondary hover:bg-bg transition-colors"
                                on:click={() => (rightView = "services")}
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
                {blockedTaskIds}
                {otherInvoiceNumbers}
                pdfBusy={generatingPdf}
                pdfAvailable={isTauriAvailable()}
                onUpdate={updateSelectedInvoice}
                onDelete={deleteSelectedInvoice}
                onGeneratePdf={generateSelectedInvoicePdf}
                onMarkSent={() => markSelectedInvoiceStatus("sent")}
                onMarkPaid={() => markSelectedInvoiceStatus("paid")}
            />
        {/if}
    </div>
</div>