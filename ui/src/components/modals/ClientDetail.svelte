<!-- @module:projects -->
<script lang="ts">
    import { onDestroy } from "svelte";
    import { addProject, updateClient } from "../../stores/projectStore";
    import type { Client, Invoice, Project } from "../../domain/types";
    import { formatDateDe, formatHm, today } from "../../domain/dateUtils";
    import { formatEuro } from "../../lib/invoiceMoney";
    import { displayStatus, invoiceGrossCents } from "../../lib/invoiceStatus";
    import type { ClientStats } from "../../lib/clientStats";
    import { nameInitials } from "../../lib/navigation";
    import { textOnColor } from "../../lib/clientStats";
    import ColorSwatches from "../views/ColorSwatches.svelte";
    import InvoiceStatusBadge from "./InvoiceStatusBadge.svelte";

    export let client: Client;
    export let projects: Project[] = [];
    export let invoices: Invoice[] = [];
    export let stats: ClientStats;
    export let csvBusy = false;
    export let csvMessage = "";
    export let onProjectOpen: (projectId: string) => void;
    export let onInvoiceOpen: (invoiceId: string) => void;
    export let onNewInvoice: () => void;
    export let onExportCsv: () => void;
    export let onDelete: () => void;

    const STATUS_LABELS = { active: "Aktiv", paused: "Pausiert", done: "Abgeschlossen" } as const;

    let editing = false;
    let creatingProject = false;
    let projectName = "";
    // One pending save per field; the client id is bound when the edit happens.
    const pendingSaves = new Map<string, { timer: ReturnType<typeof setTimeout>; run: () => void }>();

    function scheduleSave(field: keyof Client, value: unknown) {
        const id = client.id;
        const key = `${id}:${field}`;
        const prev = pendingSaves.get(key);
        if (prev) clearTimeout(prev.timer);
        const run = () => {
            pendingSaves.delete(key);
            updateClient(id, { [field]: value } as Partial<Client>);
        };
        pendingSaves.set(key, { timer: setTimeout(run, 400), run });
    }

    function flush() {
        for (const { timer, run } of [...pendingSaves.values()]) {
            clearTimeout(timer);
            run();
        }
    }
    onDestroy(flush);

    function onStr(field: keyof Client) {
        return (e: Event) => {
            const value = (e.currentTarget as HTMLInputElement | HTMLTextAreaElement).value;
            if (field === "name" && !value.trim()) return;
            scheduleSave(field, value);
        };
    }

    function onRate(e: Event) {
        scheduleSave("hourlyRate", parseFloat((e.currentTarget as HTMLInputElement).value) || undefined);
    }

    function finishEditing() {
        flush();
        editing = false;
    }

    function createProject() {
        const name = projectName.trim();
        if (!name) return;
        const project = addProject(client.id, name);
        creatingProject = false;
        projectName = "";
        onProjectOpen(project.id);
    }

    $: todayKey = today();
    $: sortedInvoices = [...invoices].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    $: fields = [
        { label: "Ansprechpartner", value: client.contactPerson },
        { label: "E-Mail", value: client.email },
        { label: "Telefon", value: client.phone },
        { label: "Kundennummer", value: client.customerNumber },
        { label: "Stundensatz", value: client.hourlyRate != null ? `${formatEuro(Math.round(client.hourlyRate * 100))} · eigener Satz` : "" },
        { label: "Anschrift", value: client.address },
    ];
</script>

<div class="flex-[999_1_480px] min-w-0 flex flex-col gap-4">
    <section aria-label="Kundendaten" class="et-card flex flex-col gap-4 p-5">
        <div class="flex flex-wrap items-center gap-3">
            <span class="w-9 h-9 rounded-[9px] flex items-center justify-center text-[13px] font-semibold flex-shrink-0" style="background:{client.color};color:{textOnColor(client.color)}" aria-hidden="true">{nameInitials(client.name)}</span>
            <h2 class="flex-[1_1_200px] text-[20px] font-bold min-w-0 break-words">{client.name}</h2>
            <button class="et-btn et-btn-accent et-btn-md" on:click={onNewInvoice}>Neue Rechnung</button>
            <button class="et-btn et-btn-md" aria-expanded={creatingProject} on:click={() => (creatingProject = !creatingProject)}>Neues Projekt</button>
            {#if editing}
                <button class="et-btn et-btn-primary et-btn-md" on:click={finishEditing}>Fertig</button>
            {:else}
                <button class="et-btn et-btn-md" on:click={() => (editing = true)}>Bearbeiten</button>
            {/if}
        </div>

        {#if creatingProject}
            <form class="flex flex-wrap items-end gap-3 px-4 py-3 rounded-xl" style="background:var(--et-accent-soft)" aria-label="Neues Projekt für {client.name}" on:submit|preventDefault={createProject}>
                <div class="flex-[1_1_240px] flex flex-col gap-1">
                    <label class="et-label" for="cd-project-name">Projektname</label>
                    <!-- svelte-ignore a11y-autofocus -->
                    <input id="cd-project-name" class="et-field" bind:value={projectName} autofocus />
                </div>
                <button type="submit" class="et-btn et-btn-primary" disabled={!projectName.trim()}>Anlegen</button>
                <button type="button" class="et-btn" on:click={() => (creatingProject = false)}>Abbrechen</button>
            </form>
        {/if}

        {#if editing}
            <div class="grid gap-x-4 gap-y-3.5" style="grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))" on:focusout={flush}>
                <div class="flex flex-col gap-1.5" style="grid-column:1/-1">
                    <label class="et-label" for="cd-name">Kundenname</label>
                    <input id="cd-name" class="et-field" value={client.name} on:input={onStr("name")} on:blur={(e) => { if (!e.currentTarget.value.trim()) e.currentTarget.value = client.name; }} />
                </div>
                <div class="flex flex-col gap-1.5">
                    <label class="et-label" for="cd-number">Kundennummer</label>
                    <input id="cd-number" class="et-field" value={client.customerNumber ?? ""} placeholder="A000112" on:input={onStr("customerNumber")} />
                </div>
                <div class="flex flex-col gap-1.5">
                    <label class="et-label" for="cd-contact">Ansprechpartner</label>
                    <input id="cd-contact" class="et-field" value={client.contactPerson ?? ""} placeholder="Max Mustermann" on:input={onStr("contactPerson")} />
                </div>
                <div class="flex flex-col gap-1.5">
                    <label class="et-label" for="cd-email">E-Mail</label>
                    <input id="cd-email" class="et-field" type="email" value={client.email ?? ""} placeholder="kontakt@firma.de" on:input={onStr("email")} />
                </div>
                <div class="flex flex-col gap-1.5">
                    <label class="et-label" for="cd-phone">Telefon</label>
                    <input id="cd-phone" class="et-field" value={client.phone ?? ""} placeholder="+49 30 …" on:input={onStr("phone")} />
                </div>
                <div class="flex flex-col gap-1.5">
                    <label class="et-label" for="cd-rate">Stundensatz (€)</label>
                    <input id="cd-rate" class="et-field" type="number" min="0" step="0.01" value={client.hourlyRate ?? ""} placeholder="95" on:input={onRate} />
                </div>
                <div class="flex flex-col gap-1.5" style="grid-column:1/-1">
                    <label class="et-label" for="cd-address">Anschrift</label>
                    <input id="cd-address" class="et-field" value={client.address ?? ""} placeholder="Musterstraße 1, 10115 Berlin" on:input={onStr("address")} />
                </div>
                <div class="flex flex-col gap-1.5" style="grid-column:1/-1">
                    <label class="et-label" for="cd-notes">Notizen</label>
                    <textarea id="cd-notes" class="et-field resize-y" rows="4" value={client.notes ?? ""} placeholder="Zugänge, Besonderheiten, Ansprechpartner-Info…" on:input={onStr("notes")}></textarea>
                </div>
                <div class="flex flex-col gap-2" style="grid-column:1/-1">
                    <span class="et-label">Farbe</span>
                    <ColorSwatches color={client.color} label="Kundenfarbe" onPick={(c) => updateClient(client.id, { color: c })} />
                </div>
                <div style="grid-column:1/-1">
                    <button class="et-btn et-btn-danger" on:click={onDelete}>Kunde löschen</button>
                </div>
            </div>
        {:else}
            <dl class="grid gap-x-5 gap-y-3.5 m-0" style="grid-template-columns:repeat(auto-fit,minmax(min(190px,100%),1fr))">
                {#each fields as f (f.label)}
                    <div class="flex flex-col gap-0.5">
                        <dt class="text-[12px]" style="color:var(--et-text-3)">{f.label}</dt>
                        <dd class="m-0 font-medium break-words" style={f.value ? "" : "color:var(--et-text-3);font-weight:400"}>{f.value || "–"}</dd>
                    </div>
                {/each}
                {#if client.notes?.trim()}
                    <div class="flex flex-col gap-0.5" style="grid-column:1/-1">
                        <dt class="text-[12px]" style="color:var(--et-text-3)">Notizen</dt>
                        <dd class="m-0 whitespace-pre-wrap">{client.notes}</dd>
                    </div>
                {/if}
            </dl>
        {/if}
    </section>

    <div class="grid gap-4" style="grid-template-columns:repeat(auto-fit,minmax(min(170px,100%),1fr))">
        <div class="et-tile">
            <span class="et-tile-label">Erfasst gesamt</span>
            <span class="et-tile-value">{formatHm(stats.trackedMinutes)}</span>
            <span class="et-tile-note">in {stats.projectCount} {stats.projectCount === 1 ? "Projekt" : "Projekten"}</span>
        </div>
        <div class="et-tile">
            <span class="et-tile-label">Offene Rechnungen</span>
            <span class="et-tile-value">{formatEuro(stats.openCents)}</span>
            <span class="et-tile-note" style={stats.overdueCount ? "color:var(--et-danger);font-weight:600" : ""}>{stats.overdueCount ? `${stats.overdueCount} überfällig` : "gesendet, nicht bezahlt"}</span>
        </div>
        <div class="et-tile">
            <span class="et-tile-label">Bezahlt gesamt</span>
            <span class="et-tile-value">{formatEuro(stats.paidCents)}</span>
            <span class="et-tile-note">{stats.paidCount} {stats.paidCount === 1 ? "Rechnung" : "Rechnungen"}</span>
        </div>
    </div>

    <section aria-label="Projekte des Kunden" class="et-card flex flex-col">
        <h2 class="et-h2 px-5 py-3.5">Projekte</h2>
        {#each projects as p (p.id)}
            <button class="et-row flex items-center gap-3 min-h-14 px-5 w-full text-left" on:click={() => onProjectOpen(p.id)}>
                <span class="w-2.5 h-2.5 rounded-[3px] flex-shrink-0" style="background:{p.color}" aria-hidden="true"></span>
                <span class="flex-1 font-semibold truncate">{p.name}</span>
                {#if p.status !== "active"}<span class="et-badge">{STATUS_LABELS[p.status]}</span>{/if}
                {#if p.deadline}<span class="text-[13px]" style="color:var(--et-text-3)">Deadline {formatDateDe(p.deadline)}</span>{/if}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--et-text-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>
            </button>
        {/each}
        {#if projects.length === 0}
            <p class="et-row px-5 py-4 text-[13px]" style="color:var(--et-text-3)">Noch keine Projekte für diesen Kunden.</p>
        {/if}
    </section>

    <section aria-label="Rechnungen des Kunden" class="et-card flex flex-col">
        <div class="flex items-center gap-3 px-5 py-3.5">
            <h2 class="et-h2 flex-1">Rechnungen</h2>
            <button class="et-btn et-btn-sm" disabled={csvBusy} on:click={onExportCsv}>{csvBusy ? "CSV wird erstellt …" : "Zeiten als CSV"}</button>
        </div>
        {#if csvMessage}
            <p class="px-5 pb-3 text-[13px]" role="status" style="color:{csvMessage.startsWith('CSV exportiert') ? 'var(--et-success-text)' : 'var(--et-danger)'}">{csvMessage}</p>
        {/if}
        {#each sortedInvoices as inv (inv.id)}
            <button class="et-row flex items-center gap-3 min-h-14 px-5 w-full text-left" on:click={() => onInvoiceOpen(inv.id)}>
                <span class="flex-1 font-semibold truncate">{inv.invoiceNumber || "Ohne Nummer"}</span>
                <span class="text-[13px]" style="color:var(--et-text-3)">{formatDateDe(inv.date)}{inv.status === "sent" ? ` · fällig ${formatDateDe(inv.dueDate)}` : ""}</span>
                <InvoiceStatusBadge status={displayStatus(inv, todayKey)} />
                <span class="w-24 text-right font-semibold tabular-nums">{formatEuro(invoiceGrossCents(inv))}</span>
            </button>
        {/each}
        {#if sortedInvoices.length === 0}
            <p class="et-row px-5 py-4 text-[13px]" style="color:var(--et-text-3)">Noch keine Rechnungen für diesen Kunden.</p>
        {/if}
    </section>
</div>
