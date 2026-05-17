<!-- @core -->
<script lang="ts">
    import {
        $appConfig as appConfigStore,
        saveAppConfig,
    } from "../../stores/configStore";
    import {
        runExportWithFeedback,
        runSnapshotWithFeedback,
        restoreFromBackupFile,
    } from "../../lib/backupActions";
    import { isTauriAvailable } from "../../lib/platform";

    let config = appConfigStore.get();
    let importInput: HTMLInputElement | null = null;

    appConfigStore.subscribe((c) => {
        if (c) config = c;
    });

    async function importBackup(event: Event) {
        const file = (event.currentTarget as HTMLInputElement).files?.[0];
        if (!file) return;
        const activeTenant = config.tenants.find(
            (tenant) => tenant.path === config.active_tenant,
        );
        const targetLabel = isTauriAvailable()
            ? (activeTenant?.name ?? "den aktiven Arbeitsbereich")
            : "den aktuellen Browser-Speicher";
        const confirmed = confirm(
            `Backup "${file.name}" wirklich in ${targetLabel} importieren? Bestehende Daten werden überschrieben.`,
        );
        if (!confirmed) {
            if (importInput) importInput.value = "";
            return;
        }
        await restoreFromBackupFile(file);
        if (importInput) importInput.value = "";
    }
</script>

<section class="panel-section flex flex-col gap-4">
    <h2
        class="text-base font-semibold text-primary border-b border-border pb-2"
    >
        Backups
    </h2>

    <div
        class="rounded-2xl border border-border bg-white/60 px-4 py-3 text-sm text-secondary shadow-[0_1px_0_rgba(255,255,255,0.75)_inset]"
    >
        Import und Restore arbeiten immer auf
        <span class="font-medium text-primary">
            {isTauriAvailable()
                ? (config.tenants.find(
                      (tenant) => tenant.path === config.active_tenant,
                  )?.name ?? "dem aktiven Arbeitsbereich")
                : "dem aktuellen Browser-Speicher"}
        </span>. Ein Import ersetzt die vorhandenen Daten vollständig.
    </div>

    <div
        class="rounded-2xl border border-border bg-white/60 px-4 py-3 text-sm text-secondary shadow-[0_1px_0_rgba(255,255,255,0.75)_inset]"
    >
        Neue JSON-Backups, Rechnungen, Angebote und Projektberichte landen standardmaessig in
        <span class="font-medium text-primary break-all">
            {config.default_export_dir ?? "dem Standardordner des Systems"}
        </span>.
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button class="action-card" on:click={runExportWithFeedback}>
            <span class="action-card__title">JSON exportieren</span>
            <span class="action-card__text"
                >Vollständiges Backup lokal speichern.</span
            >
        </button>

        <button
            class="action-card"
            on:click={() => importInput?.click()}
        >
            <span class="action-card__title">JSON importieren</span>
            <span class="action-card__text"
                >Backup einspielen und Daten sofort neu laden.</span
            >
        </button>

        <button class="action-card" on:click={runSnapshotWithFeedback}>
            <span class="action-card__title">Snapshot speichern</span>
            <span class="action-card__text"
                >{isTauriAvailable()
                    ? "Täglichen Snapshot in der Desktop-App anstoßen."
                    : "Nur in der Desktop-App verfügbar."}</span
            >
        </button>
    </div>

    <input
        bind:this={importInput}
        class="hidden"
        type="file"
        accept="application/json,.json"
        on:change={importBackup}
    />
</section>

{#if isTauriAvailable()}
<section class="panel-section flex flex-col gap-4">
    <h2 class="text-base font-semibold text-primary border-b border-border pb-2">
        Protokoll
    </h2>
    <label class="flex items-start gap-3 cursor-pointer">
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
            <span class="text-sm font-medium text-primary">Aktivitätsprotokoll aktivieren</span>
            <span class="text-xs text-muted">
                Schreibt <code>app.log</code> in den Arbeitsbereich-Ordner.
                Ältere Einträge werden automatisch verworfen (Rolling, max. 512 KB).
            </span>
        </div>
    </label>
</section>
{/if}

<style>
    .panel-section {
        padding: 20px;
        border: 1px solid color-mix(in srgb, var(--color-border) 78%, white);
        border-radius: 20px;
        background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.88),
            rgba(255, 255, 255, 0.68)
        );
        box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.7) inset,
            0 14px 28px rgba(15, 23, 42, 0.05);
        backdrop-filter: blur(14px);
    }
    .action-card {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 14px;
        text-align: left;
        border: 1px solid var(--color-border);
        border-radius: 18px;
        background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.86),
            rgba(255, 255, 255, 0.66)
        );
        transition:
            border-color 0.15s,
            background 0.15s,
            transform 0.15s,
            box-shadow 0.15s;
        box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.7) inset,
            0 10px 20px rgba(15, 23, 42, 0.04);
    }
    .action-card:hover {
        background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.96),
            rgba(246, 249, 255, 0.84)
        );
        border-color: var(--color-accent);
        transform: translateY(-1px);
    }
    .action-card__title {
        color: var(--color-text-primary);
        font-size: 13px;
        font-weight: 600;
    }
    .action-card__text {
        color: var(--color-text-muted);
        font-size: 12px;
        line-height: 1.45;
    }
</style>
