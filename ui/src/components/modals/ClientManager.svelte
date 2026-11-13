<!-- @module:projects -->
<script lang="ts">
    import {
        $clients as clientsStore,
        $projects as projectsStore,
        $selectedClientId as selectedClientIdStore,
        addClient,
    } from "../../stores/projectStore";
    import { deleteClientCascade } from "../../lib/taskActions";
    import { $tasks as tasksStore } from "../../stores/taskStore";
    import { $bridgeTimeEntries as timeEntriesStore, $bridgeInvoices as invoicesStore } from "../../stores/coreBridge";
    import { toast } from "../../stores/toastStore";
    import { today } from "../../domain/dateUtils";
    import { formatEuro } from "../../lib/invoiceMoney";
    import { clientStats, filterClients, textOnColor } from "../../lib/clientStats";
    import { clientCsvFilename, clientTimeCsv } from "../../lib/clientCsv";
    import { saveCsvFile } from "../../lib/csvExport";
    import { nameInitials } from "../../lib/navigation";
    import ClientDetail from "./ClientDetail.svelte";

    export let onProjectOpen: (projectId: string) => void;
    export let onInvoiceOpen: (invoiceId: string) => void;
    export let onNewInvoice: (clientId: string) => void;

    $: clients = $clientsStore;
    $: projects = $projectsStore;
    $: tasks = $tasksStore;
    $: timeEntries = $timeEntriesStore;
    $: invoices = $invoicesStore;
    $: todayKey = today();

    let query = "";
    let addingClient = false;
    let newClientName = "";
    let csvBusy = false;
    let csvMessage = "";

    $: selectedClientId = $selectedClientIdStore;
    $: selectedClient = selectedClientId ? (clients.find((c) => c.id === selectedClientId) ?? null) : null;
    $: selectedStats = selectedClient ? statsById.get(selectedClient.id) : undefined;
    $: shown = filterClients(clients, query);
    $: statsById = new Map(
        clients.map((c) => [c.id, clientStats(c.id, projects, tasks, timeEntries, invoices, todayKey, Date.now())]),
    );
    $: activeProjects = projects.filter((p) => p.status === "active" && p.clientId).length;

    function subline(clientId: string): { text: string; warn: boolean } {
        const s = statsById.get(clientId);
        if (!s) return { text: "", warn: false };
        if (s.overdueCount > 0) return { text: `${formatEuro(s.overdueCents)} überfällig`, warn: true };
        const parts = [`${s.projectCount} ${s.projectCount === 1 ? "Projekt" : "Projekte"}`];
        if (s.openCents > 0) parts.push(`${formatEuro(s.openCents)} offen`);
        else if (s.draftCount > 0) parts.push(`${s.draftCount} ${s.draftCount === 1 ? "Entwurf" : "Entwürfe"}`);
        return { text: parts.join(" · "), warn: false };
    }

    function handleAddClient() {
        if (!newClientName.trim()) return;
        const client = addClient(newClientName.trim());
        selectedClientIdStore.set(client.id);
        newClientName = "";
        addingClient = false;
    }

    function handleDeleteClient() {
        if (!selectedClient) return;
        const clientProjectIds = new Set(projects.filter((p) => p.clientId === selectedClient!.id).map((p) => p.id));
        const taskCount = tasks.filter((t) => t.projectId && clientProjectIds.has(t.projectId)).length;
        const invoiceCount = invoices.filter((i) => i.clientId === selectedClient!.id).length;
        if (
            confirm(
                `Kunden "${selectedClient.name}" löschen?\n\nGelöscht werden ${clientProjectIds.size} Projekt(e) mit ${taskCount} Aufgabe(n), Rechnungspositionen, Zeiteinträgen und Terminen.` +
                    (invoiceCount
                        ? `\n${invoiceCount} Rechnung(en) bleiben erhalten und erscheinen unter „Ohne Kunde“.`
                        : ""),
            )
        ) {
            deleteClientCascade(selectedClient.id);
            selectedClientIdStore.set(null);
        }
    }

    async function exportClientCsv() {
        if (!selectedClient) return;
        const csv = clientTimeCsv(selectedClient.name, selectedClient.id, projects, tasks, timeEntries, invoices);
        csvBusy = true;
        csvMessage = "";
        try {
            await saveCsvFile(clientCsvFilename(selectedClient.name), csv);
            csvMessage = "CSV exportiert.";
        } catch (error) {
            csvMessage = `CSV-Export fehlgeschlagen: ${String(error)}`;
            toast(csvMessage, "error", 5000);
        } finally {
            csvBusy = false;
            setTimeout(() => {
                csvMessage = "";
            }, 4000);
        }
    }
</script>

<div class="flex-1 overflow-y-auto">
    <div class="flex flex-col gap-5 px-8 pt-5 pb-7">
        <header class="flex flex-wrap items-center gap-3">
            <div class="flex-[1_1_280px] flex flex-col gap-0.5">
                <h1 class="text-[24px] font-bold tracking-[-0.01em] leading-tight">Kunden</h1>
                <span class="text-[13px]" style="color:var(--et-text-3)">{clients.length} {clients.length === 1 ? "Kunde" : "Kunden"} · {activeProjects} aktive {activeProjects === 1 ? "Projekt" : "Projekte"}</span>
            </div>
            <button class="et-btn et-btn-primary" aria-expanded={addingClient} on:click={() => (addingClient = !addingClient)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>
                Neuer Kunde
            </button>
        </header>

        {#if addingClient}
            <form class="flex flex-wrap items-end gap-3 px-5 py-4 rounded-xl" style="background:var(--et-accent-soft)" aria-label="Neuer Kunde" on:submit|preventDefault={handleAddClient}>
                <div class="flex-[1_1_260px] flex flex-col gap-1">
                    <label class="et-label" for="nc-name">Kundenname</label>
                    <!-- svelte-ignore a11y-autofocus -->
                    <input id="nc-name" class="et-field" bind:value={newClientName} autofocus on:keydown={(e) => e.key === "Escape" && (addingClient = false)} />
                </div>
                <button type="submit" class="et-btn et-btn-primary" disabled={!newClientName.trim()}>Anlegen</button>
                <button type="button" class="et-btn" on:click={() => (addingClient = false)}>Abbrechen</button>
            </form>
        {/if}

        <div class="flex flex-wrap items-start gap-5">
            <section aria-label="Kundenliste" class="et-card flex flex-col flex-[1_1_280px] max-w-[340px] min-w-0 overflow-hidden">
                <label class="flex items-center gap-2 min-h-12 px-4 border-b focus-within:outline-2 focus-within:-outline-offset-2" style="border-color:var(--et-border-subtle);outline-color:var(--et-accent)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--et-text-3)" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6"></circle><path d="M16 16l4 4"></path></svg>
                    <input type="search" class="flex-1 min-w-0 h-11 bg-transparent border-none outline-none" aria-label="Kunde suchen" placeholder="Kunde suchen" bind:value={query} />
                </label>
                {#each shown as client (client.id)}
                    {@const sub = subline(client.id)}
                    {@const active = selectedClientId === client.id}
                    <button
                        class="flex items-center gap-3 min-h-16 pr-4 text-left border-t first:border-t-0"
                        style="padding-left:{active ? 13 : 16}px;border-color:var(--et-border-subtle);{active ? 'border-left:3px solid var(--et-accent);background:var(--et-accent-soft)' : ''}"
                        aria-current={active ? "true" : undefined}
                        on:click={() => selectedClientIdStore.set(client.id)}
                    >
                        <span class="w-8 h-8 rounded-[9px] flex items-center justify-center text-[12px] font-semibold flex-shrink-0" style="background:{client.color};color:{textOnColor(client.color)}" aria-hidden="true">{nameInitials(client.name)}</span>
                        <span class="flex-1 min-w-0 flex flex-col">
                            <span class="font-semibold truncate">{client.name}</span>
                            <span class="text-[12px] truncate" style="color:{sub.warn ? 'var(--et-danger)' : 'var(--et-text-3)'};font-weight:{sub.warn ? 600 : 400}">{sub.text}</span>
                        </span>
                    </button>
                {/each}
                {#if shown.length === 0}
                    <p class="px-4 py-4 text-[13px]" style="color:var(--et-text-3)">{clients.length === 0 ? "Noch keine Kunden." : "Kein Kunde passt zur Suche."}</p>
                {/if}
            </section>

            {#if selectedClient && selectedStats}
                {#key selectedClient.id}
                    <ClientDetail
                        client={selectedClient}
                        projects={projects.filter((p) => p.clientId === selectedClient.id)}
                        invoices={invoices.filter((i) => i.clientId === selectedClient.id)}
                        stats={selectedStats}
                        {csvBusy}
                        {csvMessage}
                        {onProjectOpen}
                        {onInvoiceOpen}
                        onNewInvoice={() => onNewInvoice(selectedClient.id)}
                        onExportCsv={exportClientCsv}
                        onDelete={handleDeleteClient}
                    />
                {/key}
            {:else}
                <div class="et-hint flex-[999_1_480px] min-w-0">{clients.length === 0 ? "Lege deinen ersten Kunden an, um Projekte und Rechnungen zuzuordnen." : "Wähle einen Kunden aus der Liste."}</div>
            {/if}
        </div>
    </div>
</div>
