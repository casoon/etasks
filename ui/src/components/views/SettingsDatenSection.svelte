<!-- @core -->
<script lang="ts">
    import { onMount } from "svelte";
    import {
        $appConfig as appConfigStore,
        saveAppConfig,
    } from "../../stores/configStore";
    import {
        runExportWithFeedback,
        runSnapshotWithFeedback,
        restoreFromBackupFile,
        restoreFromSnapshot,
    } from "../../lib/backupActions";
    import { listSnapshots, type SnapshotInfo } from "../../lib/exportService";
    import { KEYS, storageGet } from "../../lib/storage";
    import { snapshotLabel, type SnapshotMeta } from "../../lib/navigation";
    import { fileSizeLabel, snapshotDateLabel } from "../../lib/settingsStatus";
    import { isTauriAvailable } from "../../lib/platform";

    const VISIBLE_SNAPSHOTS = 3;

    let config = appConfigStore.get();
    let importInput: HTMLInputElement | null = null;
    let snapshots: SnapshotInfo[] = [];
    let showAll = false;
    let busy = false;
    let lastLabel: string | null = null;

    appConfigStore.subscribe((c) => {
        if (c) config = c;
    });

    $: desktop = isTauriAvailable();
    $: folder = `${config.default_export_dir ?? "Downloads"}/Sicherungen`;
    $: visible = showAll ? snapshots : snapshots.slice(0, VISIBLE_SNAPSHOTS);
    $: workspaceName = desktop
        ? (config.tenants.find((t) => t.path === config.active_tenant)?.name ?? "dem aktiven Arbeitsbereich")
        : "dem aktuellen Browser-Speicher";

    async function refresh() {
        lastLabel = snapshotLabel(storageGet<SnapshotMeta>(KEYS.exportMeta));
        try {
            snapshots = await listSnapshots();
        } catch {
            snapshots = [];
        }
    }

    onMount(refresh);

    async function snapshotNow() {
        busy = true;
        await runSnapshotWithFeedback();
        await refresh();
        busy = false;
    }

    async function restore(filename: string) {
        busy = true;
        await restoreFromSnapshot(filename);
        await refresh();
        busy = false;
    }

    async function importBackup(event: Event) {
        const file = (event.currentTarget as HTMLInputElement).files?.[0];
        if (!file) return;
        await restoreFromBackupFile(file);
        if (importInput) importInput.value = "";
        await refresh();
    }
</script>

<section class="et-card p-5 flex flex-col gap-4" aria-labelledby="backup-title">
    <div class="flex flex-wrap items-center gap-3">
        <span
            class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={lastLabel
                ? "background:var(--et-success-soft);color:var(--et-success-text)"
                : "background:var(--et-warning-soft);color:var(--et-warning-text)"}
            aria-hidden="true"
        >
            {#if lastLabel}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"></path></svg>
            {:else}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7v6M12 17h.01"></path></svg>
            {/if}
        </span>
        <div class="flex-[1_1_240px] flex flex-col">
            <h2 id="backup-title" class="text-[16px] font-semibold">
                {#if !desktop}Sicherung nur in der Desktop-App{:else if lastLabel}Deine Daten sind gesichert{:else}Noch keine Sicherung{/if}
            </h2>
            <span class="text-[13px]" style="color:var(--et-text-3)">
                {#if desktop}
                    Tägliche Sicherung{lastLabel ? ` · zuletzt ${lastLabel}` : ""} · die letzten 14 Stände werden aufbewahrt
                {:else}
                    Im Browser bleiben die Daten im Browser-Speicher. Export und Import funktionieren.
                {/if}
            </span>
        </div>
        <button class="et-btn et-btn-primary" disabled={!desktop || busy} on:click={snapshotNow}>Jetzt sichern</button>
    </div>
    {#if desktop}
        <div class="flex flex-col gap-1.5 pt-3.5" style="border-top:1px solid var(--et-border-subtle)">
            <span class="et-label">Ordner für Sicherungen und Exporte</span>
            <span class="min-h-[44px] flex items-center px-3 rounded-[9px] text-[13px] break-all" style="border:1px solid var(--et-border-strong);background:var(--et-surface-sunken)">{folder}</span>
            <span class="text-[12px]" style="color:var(--et-text-3)">
                Der Ordner wird unter Arbeitsbereiche geändert. Die tägliche Sicherung enthält keine Bank- und Steuerdaten, der vollständige Export unten schon. Das ist eine lokale Datei, keine Cloud-Sicherung.
            </span>
        </div>
    {/if}
</section>

{#if desktop}
    <section class="et-card flex flex-col" aria-labelledby="snapshots-title">
        <h2 id="snapshots-title" class="et-h2 px-5 py-3.5">Letzte Sicherungen</h2>
        {#each visible as snapshot (snapshot.filename)}
            <div class="et-row flex items-center gap-3 min-h-[52px] pl-5 pr-3">
                <span class="flex-1 font-medium">{snapshotDateLabel(snapshot.date)}</span>
                <span class="text-[13px]" style="color:var(--et-text-3)">{fileSizeLabel(snapshot.sizeBytes)}</span>
                <button class="et-btn et-btn-md text-[13px]" disabled={busy} on:click={() => restore(snapshot.filename)}>
                    Wiederherstellen<span class="sr-only"> vom {snapshotDateLabel(snapshot.date)}</span>
                </button>
            </div>
        {:else}
            <p class="et-row px-5 py-4 text-[13px]" style="color:var(--et-text-3)">Noch keine Sicherung im Ordner.</p>
        {/each}
        {#if snapshots.length > VISIBLE_SNAPSHOTS}
            <button class="et-btn et-btn-ghost justify-start mx-2 mb-2" aria-expanded={showAll} on:click={() => (showAll = !showAll)}>
                {showAll ? "Weniger anzeigen" : `${snapshots.length - VISIBLE_SNAPSHOTS} ältere anzeigen`}
            </button>
        {/if}
    </section>
{/if}

<div class="grid gap-4" style="grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr))">
    <section class="et-card p-5 flex flex-col gap-2.5" aria-labelledby="export-title">
        <h2 id="export-title" class="et-h2">Alles exportieren</h2>
        <p class="text-[13px]" style="color:var(--et-text-3)">
            Eine JSON-Datei mit allen Daten von {workspaceName}, inklusive Profil. Zum Umziehen auf einen anderen Rechner.
            Neue Exporte, Rechnungen, Angebote und Projektberichte landen standardmäßig in
            <span class="font-medium break-all" style="color:var(--et-text)">{config.default_export_dir ?? "dem Standardordner des Systems"}</span>.
        </p>
        <button class="et-btn self-start" on:click={runExportWithFeedback}>Export erstellen</button>
    </section>
    <section class="et-card p-5 flex flex-col gap-2.5" aria-labelledby="import-title">
        <h2 id="import-title" class="et-h2">Aus Datei wiederherstellen</h2>
        <p class="text-[13px]" style="color:var(--et-text-3)">
            Ersetzt die Daten von {workspaceName} vollständig. Die Datei wird vorher geprüft, und der jetzige Stand wird zuerst gesichert.
        </p>
        <button class="et-btn et-btn-danger self-start" style="border-color:var(--et-danger)" on:click={() => importInput?.click()}>Datei auswählen …</button>
    </section>
</div>

<input
    bind:this={importInput}
    class="hidden"
    type="file"
    accept="application/json,.json"
    aria-label="Backup-Datei auswählen"
    on:change={importBackup}
/>

{#if desktop}
    <section class="et-card p-5 flex flex-col gap-4" aria-labelledby="log-title">
        <h2 id="log-title" class="et-h2">Protokoll</h2>
        <label class="flex items-start gap-3 cursor-pointer min-h-[44px]">
            <input
                type="checkbox"
                class="mt-0.5"
                checked={config.logging_enabled ?? false}
                on:change={async (e) => {
                    const updated = { ...config, logging_enabled: e.currentTarget.checked };
                    await saveAppConfig(updated);
                    config = appConfigStore.get();
                }}
            />
            <div class="flex flex-col gap-0.5">
                <span class="text-sm font-medium">Aktivitätsprotokoll aktivieren</span>
                <span class="text-[13px]" style="color:var(--et-text-3)">
                    Schreibt <code>app.log</code> in den Arbeitsbereich-Ordner.
                    Ältere Einträge werden automatisch verworfen (Rolling, max. 512 KB).
                </span>
            </div>
        </label>
    </section>
{/if}
