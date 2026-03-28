<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import {
        $appConfig as appConfigStore,
        saveAppConfig,
        writeTenantMeta,
    } from "../stores/configStore";
    import { activateTenant } from "../lib/appBootstrap";
    import { isTauriAvailable } from "../lib/platform";
    import type { AppConfig } from "../stores/configStore";

    export let onDone: () => void = () => {};

    let tenantName = "";
    let saving = false;
    let errorMsg = "";

    const config = appConfigStore.get();

    async function finish() {
        const displayName = tenantName.trim();
        if (!displayName) {
            errorMsg = "Bitte gib zuerst einen Namen für den Mandanten an.";
            return;
        }
        saving = true;
        errorMsg = "";
        try {
            if (!isTauriAvailable()) {
                errorMsg =
                    "Das initiale Setup mit lokalem Workspace ist nur in der Desktop-App verfügbar.";
                saving = false;
                return;
            }
            const path = await invoke<string>("default_tenant_path", {
                tenantName: displayName,
            });
            const updated: AppConfig = {
                ...config,
                setup_done: true,
                profile: {
                    ...config.profile,
                    company:
                        config.profile.company === "Musterfirma GmbH"
                            ? displayName
                            : config.profile.company,
                },
            };
            await saveAppConfig(updated);
            await activateTenant(path, displayName);
            await writeTenantMeta(displayName);
            onDone();
        } catch (e) {
            errorMsg = String(e);
            saving = false;
        }
    }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
    <div
        class="bg-surface border border-border rounded-xl shadow-xl w-full max-w-lg p-8 flex flex-col gap-6"
    >
        {#if !isTauriAvailable()}
            <div
                class="rounded-2xl border border-border bg-bg/80 px-4 py-3 text-sm text-secondary"
            >
                Im Browser läuft eTasks ohne lokalen Workspace. Für
                Dateiauswahl, PDF-Export und Snapshots bitte die Desktop-App
                verwenden.
            </div>
        {/if}
        <div class="flex flex-col gap-2">
            <h2 class="text-lg font-semibold text-primary">
                Willkommen bei eTasks
            </h2>
            <p class="text-sm text-secondary">
                Wir legen jetzt deinen ersten Mandanten an und speichern alles
                automatisch im lokalen App-Datenordner. Rechnungs- und
                Profildaten kannst du später in Ruhe ergänzen.
            </p>
        </div>

        <div class="rounded-2xl border border-border bg-white/60 p-4">
            <ul class="flex flex-col gap-2 text-sm text-secondary">
                <li>Ein Mandant wird lokal angelegt.</li>
                <li>Eine Datenbank wird automatisch vorbereitet.</li>
                <li>Weitere Einstellungen kommen erst später.</li>
            </ul>
        </div>

        <div class="flex flex-col gap-3">
            <label class="flex flex-col gap-1">
                <span class="text-xs text-muted font-medium">
                    Name des ersten Mandanten
                </span>
                <input
                    class="input"
                    bind:value={tenantName}
                    placeholder="z. B. Studio Nord"
                />
            </label>

            {#if errorMsg}
                <p class="text-xs text-red-500">{errorMsg}</p>
            {/if}
        </div>

        <div class="flex justify-end">
            <button
                class="px-5 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 shadow-sm"
                disabled={saving || !tenantName.trim()}
                on:click={finish}
            >
                {saving ? "Mandant wird angelegt…" : "Mandant anlegen"}
            </button>
        </div>
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
