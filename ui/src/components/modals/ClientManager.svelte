<!-- @module:projects -->
<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import {
        $clients as clientsStore,
        $projects as projectsStore,
        addClient,
        updateClient,
        removeClient,
    } from "../../stores/projectStore";
    import { $tasks as tasksStore } from "../../stores/taskStore";
    import { $bridgeTimeEntries as timeEntriesStore, $bridgeInvoices as invoicesStore } from "../../stores/coreBridge";
    import { PROJECT_COLORS } from "../../domain/types";
    import type { Client } from "../../domain/types";
    import { isTauriAvailable } from "../../lib/platform";

    export let onProjectOpen: ((projectId: string) => void) | undefined =
        undefined;
    export let emptyProjectsMessage = "Noch keine Projekte für diesen Kunden.";

    $: clients = $clientsStore;
    $: projects = $projectsStore;
    $: tasks = $tasksStore;
    $: timeEntries = $timeEntriesStore;
    $: invoices = $invoicesStore;

    let selectedClientId: string | null = null;
    let addingClient = false;
    let newClientName = "";
    let clientFieldDebounce: ReturnType<typeof setTimeout> | null = null;
    let editingClientName = false;
    let editClientNameVal = "";
    let csvExporting = false;
    let csvMessage = "";

    $: selectedClient = selectedClientId
        ? (clients.find((c) => c.id === selectedClientId) ?? null)
        : null;
    $: clientProjects = selectedClientId
        ? projects.filter((p) => p.clientId === selectedClientId)
        : [];
    $: clientProjectIds = new Set(clientProjects.map((project) => project.id));
    $: clientTasks = tasks.filter(
        (task) => task.projectId && clientProjectIds.has(task.projectId),
    );
    $: clientInvoices = invoices.filter(
        (invoice) => invoice.clientId === selectedClientId,
    );

    function handleAddClient(e: Event) {
        e.preventDefault();
        if (!newClientName.trim()) return;
        const client = addClient(newClientName.trim());
        selectedClientId = client.id;
        newClientName = "";
        addingClient = false;
    }

    function startEditClientName() {
        if (!selectedClient) return;
        editClientNameVal = selectedClient.name;
        editingClientName = true;
    }

    function saveClientName() {
        if (selectedClientId && editClientNameVal.trim()) {
            updateClient(selectedClientId, { name: editClientNameVal.trim() });
        }
        editingClientName = false;
    }

    function handleDeleteClient() {
        if (!selectedClient) return;
        if (
            confirm(
                `Kunden "${selectedClient.name}" und alle Projekte löschen?`,
            )
        ) {
            removeClient(selectedClient.id);
            selectedClientId = null;
        }
    }

    function onClientStr(field: keyof Client) {
        return (e: Event) => {
            if (!selectedClientId) return;
            const value = (
                e.currentTarget as HTMLInputElement | HTMLTextAreaElement
            ).value;
            if (clientFieldDebounce) clearTimeout(clientFieldDebounce);
            clientFieldDebounce = setTimeout(
                () =>
                    updateClient(selectedClientId!, {
                        [field]: value,
                    } as Partial<Client>),
                400,
            );
        };
    }

    function onClientNum(field: keyof Client) {
        return (e: Event) => {
            if (!selectedClientId) return;
            const raw = (e.currentTarget as HTMLInputElement).value;
            const value = parseFloat(raw) || undefined;
            if (clientFieldDebounce) clearTimeout(clientFieldDebounce);
            clientFieldDebounce = setTimeout(
                () =>
                    updateClient(selectedClientId!, {
                        [field]: value,
                    } as Partial<Client>),
                400,
            );
        };
    }

    function csvEscape(value: string | number | null | undefined): string {
        const normalized = String(value ?? "");
        return /[",;\n]/.test(normalized)
            ? `"${normalized.replace(/"/g, '""')}"`
            : normalized;
    }

    async function exportClientCsv() {
        if (!selectedClient) return;

        const tasksById = new Map(clientTasks.map((task) => [task.id, task]));
        const projectsById = new Map(
            clientProjects.map((project) => [project.id, project]),
        );
        const invoiceByTaskId = new Map<
            string,
            { invoiceNumber: string; status: string }
        >();
        for (const invoice of clientInvoices) {
            for (const lineItem of invoice.lineItems) {
                for (const taskId of lineItem.taskIds) {
                    invoiceByTaskId.set(taskId, {
                        invoiceNumber: invoice.invoiceNumber,
                        status: invoice.status,
                    });
                }
            }
        }

        const rows = [
            [
                "Kunde",
                "Projekt",
                "Aufgabe",
                "Start",
                "Ende",
                "Minuten",
                "Stunden",
                "Rechnung",
                "Rechnungsstatus",
            ],
            ...timeEntries
                .filter(
                    (entry) =>
                        entry.projectId &&
                        clientProjectIds.has(entry.projectId),
                )
                .sort((a, b) => a.startAt.localeCompare(b.startAt))
                .map((entry) => {
                    const task = tasksById.get(entry.taskId);
                    const project = entry.projectId
                        ? projectsById.get(entry.projectId)
                        : null;
                    const invoice = invoiceByTaskId.get(entry.taskId);
                    const minutes = entry.durationMinutes ?? 0;
                    return [
                        selectedClient.name,
                        project?.name ?? "",
                        task?.title ?? "",
                        entry.startAt,
                        entry.endAt ?? "",
                        minutes,
                        Math.round((minutes / 60) * 100) / 100,
                        invoice?.invoiceNumber ?? "",
                        invoice?.status ?? "",
                    ];
                }),
        ];
        const csv = rows.map((row) => row.map(csvEscape).join(";")).join("\n");
        const filename = `etasks-${selectedClient.name.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}-abrechnung.csv`;

        csvExporting = true;
        csvMessage = "";
        try {
            if (isTauriAvailable()) {
                await invoke("export_to_file", { json: csv, filename });
            } else {
                const blob = new Blob([csv], {
                    type: "text/csv;charset=utf-8",
                });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = filename;
                link.click();
                URL.revokeObjectURL(url);
            }
            csvMessage = "CSV exportiert.";
        } catch (error) {
            csvMessage = `CSV-Export fehlgeschlagen: ${String(error)}`;
        } finally {
            csvExporting = false;
            setTimeout(() => {
                csvMessage = "";
            }, 4000);
        }
    }
</script>

<div
    class="flex-1 overflow-hidden grid"
    style="grid-template-columns: 200px 1fr"
>
    <div class="border-r border-border flex flex-col overflow-hidden">
        <div
            class="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0"
        >
            <span class="text-[11px] text-muted">{clients.length} Kunden</span>
            <button
                class="w-6 h-6 flex items-center justify-center rounded-lg text-muted text-lg hover:bg-bg hover:text-primary transition-colors"
                on:click={() => {
                    addingClient = true;
                }}
                title="Neuer Kunde">+</button
            >
        </div>
        <div class="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1">
            {#each clients as client (client.id)}
                <button
                    class="flex items-center gap-2 py-[6px] px-2 rounded-lg w-full text-left transition-colors min-w-0 {selectedClientId ===
                    client.id
                        ? 'bg-accent-subtle'
                        : 'hover:bg-bg'}"
                    on:click={() => (selectedClientId = client.id)}
                >
                    <span
                        class="w-2 h-2 rounded-full flex-shrink-0"
                        style="background:{client.color}"
                    />
                    <span
                        class="flex-1 text-[13px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 {selectedClientId ===
                        client.id
                            ? 'text-accent font-medium'
                            : 'text-primary'}">{client.name}</span
                    >
                    <span class="text-[11px] text-muted flex-shrink-0"
                        >{projects.filter((p) => p.clientId === client.id)
                            .length}P</span
                    >
                </button>
            {/each}
            {#if addingClient}
                <form class="py-1" on:submit={handleAddClient}>
                    <!-- svelte-ignore a11y-autofocus -->
                    <input
                        class="w-full px-2 py-[5px] border border-accent rounded-lg text-[13px] outline-none bg-surface"
                        bind:value={newClientName}
                        placeholder="Kundenname..."
                        autofocus
                        on:keydown={(e) => {
                            if (e.key === "Escape") addingClient = false;
                        }}
                    />
                </form>
            {/if}
            {#if clients.length === 0 && !addingClient}
                <p class="text-[13px] text-muted px-2 py-4">
                    Noch keine Kunden.
                </p>
            {/if}
        </div>
    </div>

    {#if !selectedClient}
        <div class="flex items-center justify-center text-muted text-sm">
            <p>Wähle einen Kunden aus.</p>
        </div>
    {:else}
        <div class="overflow-y-auto p-6 flex flex-col gap-6 max-w-2xl">
            <div class="flex items-center gap-3 pb-4 border-b border-border">
                <span
                    class="w-4 h-4 rounded-full flex-shrink-0"
                    style="background:{selectedClient.color}"
                />
                {#if editingClientName}
                    <!-- svelte-ignore a11y-autofocus -->
                    <input
                        class="flex-1 px-2 py-1 border border-accent rounded-lg text-base font-semibold outline-none bg-surface min-w-0"
                        bind:value={editClientNameVal}
                        autofocus
                        on:blur={saveClientName}
                        on:keydown={(e) => { if (e.key === 'Enter') saveClientName(); if (e.key === 'Escape') editingClientName = false; }}
                    />
                {:else}
                    <!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
                    <h2
                        class="text-base font-semibold text-primary flex-1 cursor-text hover:bg-bg rounded px-2 py-1 -mx-2 -my-1 transition-colors"
                        on:click={startEditClientName}
                        title="Klicken zum Bearbeiten"
                    >
                        {selectedClient.name}
                    </h2>
                {/if}
                <button
                    class="px-3 py-1 border border-border rounded-lg text-[12px] text-secondary hover:bg-bg hover:text-primary transition-colors"
                    on:click={exportClientCsv}
                    disabled={csvExporting}
                    >{csvExporting ? "CSV…" : "CSV exportieren"}</button
                >
                <button
                    class="px-3 py-1 text-red-500 border border-red-200 rounded-lg text-[12px] hover:bg-red-50 transition-colors"
                    on:click={handleDeleteClient}>Löschen</button
                >
            </div>
            {#if csvMessage}
                <p
                    class="text-[12px] {csvMessage.startsWith('CSV exportiert')
                        ? 'text-green-600'
                        : 'text-red-500'}"
                >
                    {csvMessage}
                </p>
            {/if}

            <div class="flex gap-1 flex-wrap">
                {#each PROJECT_COLORS as c (c)}
                    <button
                        class="w-[18px] h-[18px] rounded-full transition-transform hover:scale-[1.15] {selectedClient.color ===
                        c
                            ? 'ring-2 ring-secondary ring-offset-2'
                            : ''}"
                        style="background:{c}"
                        on:click={() =>
                            updateClient(selectedClient.id, { color: c })}
                        aria-label="Farbe {c}"
                    />
                {/each}
            </div>

            <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1 col-span-2">
                    <span class="text-xs text-muted font-medium"
                        >Kundenname</span
                    >
                    <input
                        class="input"
                        value={selectedClient.name}
                        on:input={onClientStr("name")}
                    />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="text-xs text-muted font-medium"
                        >Kundennummer</span
                    >
                    <input
                        class="input font-mono"
                        value={selectedClient.customerNumber ?? ""}
                        placeholder="A000112"
                        on:input={onClientStr("customerNumber")}
                    />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="text-xs text-muted font-medium"
                        >Ansprechpartner</span
                    >
                    <input
                        class="input"
                        value={selectedClient.contactPerson ?? ""}
                        placeholder="Max Mustermann"
                        on:input={onClientStr("contactPerson")}
                    />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="text-xs text-muted font-medium">E-Mail</span>
                    <input
                        class="input"
                        type="email"
                        value={selectedClient.email ?? ""}
                        placeholder="kontakt@firma.de"
                        on:input={onClientStr("email")}
                    />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="text-xs text-muted font-medium">Telefon</span>
                    <input
                        class="input"
                        value={selectedClient.phone ?? ""}
                        placeholder="+49 30 …"
                        on:input={onClientStr("phone")}
                    />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="text-xs text-muted font-medium"
                        >Stundensatz (€)</span
                    >
                    <input
                        class="input"
                        type="number"
                        value={selectedClient.hourlyRate ?? ""}
                        placeholder="95"
                        on:input={onClientNum("hourlyRate")}
                    />
                </label>
                <label class="flex flex-col gap-1 col-span-2">
                    <span class="text-xs text-muted font-medium">Adresse</span>
                    <input
                        class="input"
                        value={selectedClient.address ?? ""}
                        placeholder="Musterstraße 1, 10115 Berlin"
                        on:input={onClientStr("address")}
                    />
                </label>
                <label class="flex flex-col gap-1 col-span-2">
                    <span class="text-xs text-muted font-medium">Notizen</span>
                    <textarea
                        class="input resize-y min-h-[80px] font-mono leading-relaxed"
                        value={selectedClient.notes ?? ""}
                        placeholder="Zugänge, Besonderheiten, Ansprechpartner-Info…"
                        on:input={onClientStr("notes")}
                        rows={4}
                    />
                </label>
            </div>

            <div class="flex flex-col gap-2">
                <h3
                    class="text-[11px] font-bold uppercase tracking-widest text-muted"
                >
                    Projekte
                </h3>
                {#if clientProjects.length === 0}
                    <p class="text-[12px] text-muted italic">
                        {emptyProjectsMessage}
                    </p>
                {:else}
                    {#each clientProjects as p (p.id)}
                        {#if onProjectOpen}
                            <button
                                class="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-bg text-left transition-colors"
                                on:click={() => onProjectOpen?.(p.id)}
                            >
                                <span
                                    class="w-2 h-2 rounded-full flex-shrink-0"
                                    style="background:{p.color}"
                                />
                                <span class="flex-1 text-[13px] text-primary"
                                    >{p.name}</span
                                >
                                <span class="text-[11px] text-muted capitalize"
                                    >{p.status}</span
                                >
                            </button>
                        {:else}
                            <div
                                class="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-bg"
                            >
                                <span
                                    class="w-2 h-2 rounded-full flex-shrink-0"
                                    style="background:{p.color}"
                                />
                                <span class="flex-1 text-[13px] text-primary"
                                    >{p.name}</span
                                >
                                <span class="text-[11px] text-muted capitalize"
                                    >{p.status}</span
                                >
                            </div>
                        {/if}
                    {/each}
                {/if}
            </div>
        </div>
    {/if}
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