<script lang="ts">
    import {
        $clients as clientsStore,
        $projects as projectsStore,
    } from "../stores/projectStore";
    import { $tasks as tasksStore } from "../stores/taskStore";
    import { $services as servicesStore } from "../stores/serviceStore";
    import {
        $invoices as invoicesStore,
        addInvoice,
        updateInvoice,
        removeInvoice,
    } from "../stores/invoiceStore";
    import {
        $appConfig as appConfigStore,
        saveAppConfig,
    } from "../stores/configStore";
    import { toast } from "../stores/toastStore";
    import { isTauriAvailable } from "../lib/platform";
    import { generateInvoice, type InvoiceData } from "../lib/invoiceService";
    import type { Invoice } from "../domain/types";
    import ClientManager from "./ClientManager.svelte";
    import ServiceCatalog from "./ServiceCatalog.svelte";
    import InvoiceList from "./InvoiceList.svelte";
    import InvoiceEditor from "./InvoiceEditor.svelte";

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
    $: blockedTaskIds = new Set(
        invoices
            .filter((i) => i.id !== selectedInvoiceId)
            .flatMap((i) => i.lineItems.flatMap((li) => li.taskIds)),
    );

    async function createNewInvoice() {
        const config = appConfig;
        const prefix = config?.profile.invoice_number_prefix ?? "RE-";
        const counter = config?.profile.invoice_number_counter ?? 1;
        const dueDate = new Date();
        dueDate.setDate(
            dueDate.getDate() + (config?.profile.payment_days ?? 14),
        );

        const inv = addInvoice({
            clientId: "",
            invoiceNumber: prefix + String(counter).padStart(3, "0"),
            customerNumber: "",
            date: new Date().toISOString().slice(0, 10),
            dueDate: dueDate.toISOString().slice(0, 10),
            performancePeriod: "",
            projectReference: "",
            status: "draft",
            lineItems: [],
        });

        if (config) {
            await saveAppConfig({
                ...config,
                profile: {
                    ...config.profile,
                    invoice_number_counter: counter + 1,
                },
            });
        }

        selectedInvoiceId = inv.id;
        rightView = "invoice";
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

        const invoicePayload: InvoiceData = {
            metadata: {
                invoice_number: selectedInvoice.invoiceNumber,
                invoice_date: selectedInvoice.date,
                due_date: selectedInvoice.dueDate,
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
                show_footer: Boolean(profile.invoice_footer_text?.trim()),
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
            },
            items: selectedInvoice.lineItems.map((item, index) => {
                const total =
                    Math.round(item.unitPrice * item.quantity * 100) / 100;
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
                    rate: entry.rate,
                    base: { amount: invoiceTotals.netto },
                    amount: { amount: entry.amount },
                })),
                total: { amount: invoiceTotals.total },
            },
            payment: {
                due_date: selectedInvoice.dueDate,
                bank_transfer_note: selectedInvoice.invoiceNumber,
            },
            closing: {
                text: profile.invoice_footer_text?.trim() || undefined,
                signature: `${profile.first_name} ${profile.last_name}`.trim(),
            },
        };

        generatingPdf = true;
        try {
            const path = await generateInvoice(invoicePayload, appConfig);
            if (selectedInvoice.status === "draft") {
                updateInvoice(selectedInvoice.id, { status: "sent" });
            }
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
        if (!invoice) {
            return { netto: 0, vatEntries: [], total: 0 };
        }

        const vatBase = invoice.lineItems.reduce(
            (acc, item) => {
                const lineNet = item.unitPrice * item.quantity;
                acc.netto += lineNet;
                acc.vat[item.vatRate] = (acc.vat[item.vatRate] ?? 0) + lineNet;
                return acc;
            },
            { netto: 0, vat: {} as Record<number, number> },
        );
        const vatEntries = Object.entries(vatBase.vat).map(([rate, base]) => ({
            rate: Number(rate),
            base: Math.round(base * 100) / 100,
            amount: Math.round(base * (Number(rate) / 100) * 100) / 100,
        }));
        const netto = Math.round(vatBase.netto * 100) / 100;
        const total =
            Math.round(
                (netto +
                    vatEntries.reduce((sum, entry) => sum + entry.amount, 0)) *
                    100,
            ) / 100;
        return { netto, vatEntries, total };
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
                class="flex-1 flex flex-col items-center justify-center gap-4 text-center"
            >
                <p class="text-muted text-sm">
                    Wähle eine Rechnung oder erstelle eine neue.
                </p>
                <button
                    class="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
                    on:click={createNewInvoice}
                    >+ Neue Rechnung erstellen</button
                >
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
