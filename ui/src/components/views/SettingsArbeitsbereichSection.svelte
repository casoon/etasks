<!-- @core -->
<script lang="ts">
    import { onMount } from "svelte";
    import { invoke } from "@tauri-apps/api/core";
    import {
        $appConfig as appConfigStore,
        saveAppConfig,
        writeTenantMeta,
        removeTenant,
    } from "../../stores/configStore";
    import { activateTenant } from "../../lib/appBootstrap";
    import { metaGet, metaSet } from "../../lib/metaStore";
    import { isTauriAvailable } from "../../lib/platform";

    interface AppPaths {
        documentsDir?: string | null;
        downloadsDir?: string | null;
        appDataDir?: string | null;
    }

    interface WorkspacePaths {
        workspaceDir: string;
        databasePath: string;
        assetsDir: string;
    }

    let config = appConfigStore.get();
    let appPaths: AppPaths = {};
    let workspaceName = "";
    let workspaceType = "";
    let workspaceCurrency = "EUR";
    let workspacePaymentDays = "14";
    let workspaceInvoicePrefix = "RE";
    let workspaceCreatedAt = "";
    let workspaceSaving = false;
    let workspaceSaved = false;
    let workspaceError = "";
    let invoiceCounterReset = false;
    let addingTenant = false;
    let tenantName = "";
    let tenantDir = "";
    let workspaceFs: WorkspacePaths | null = null;
    let defaultWorkspaceDir = "";
    let defaultExportDir = "";
    let errorMsg = "";

    $: activeTenant = config.tenants.find(
        (tenant) => tenant.path === config.active_tenant,
    );

    appConfigStore.subscribe((c) => {
        if (c) config = c;
    });

    onMount(async () => {
        if (isTauriAvailable()) {
            appPaths = await invoke<AppPaths>("app_paths").catch(() => ({}));
        }
        await loadWorkspaceSettings();
    });

    async function loadWorkspaceSettings() {
        workspaceError = "";
        workspaceSaved = false;
        workspaceName = activeTenant?.name ?? "";

        if (!isTauriAvailable() || !config.active_tenant) {
            workspaceType = "browser";
            workspaceCurrency = "EUR";
            workspacePaymentDays = String(config.profile.payment_days ?? 14);
            workspaceInvoicePrefix = config.profile.invoice_number_prefix ?? "RE";
            workspaceCreatedAt = "";
            defaultWorkspaceDir = config.default_workspace_dir ?? "";
            defaultExportDir = config.default_export_dir ?? "";
            workspaceFs = null;
            return;
        }

        workspaceName =
            (await metaGet("tenant.display_name")) ?? activeTenant?.name ?? "";
        workspaceType = (await metaGet("tenant.type")) ?? "";
        workspaceCurrency = (await metaGet("defaults.currency")) ?? "EUR";
        workspacePaymentDays =
            (await metaGet("defaults.payment_term_days")) ??
            String(config.profile.payment_days ?? 14);
        workspaceInvoicePrefix =
            (await metaGet("defaults.invoice_prefix")) ??
            config.profile.invoice_number_prefix ??
            "RE";
        workspaceCreatedAt = (await metaGet("app.created_at")) ?? "";
        defaultWorkspaceDir =
            config.default_workspace_dir ??
            appPaths.documentsDir ??
            appPaths.appDataDir ??
            "";
        defaultExportDir =
            config.default_export_dir ??
            appPaths.downloadsDir ??
            appPaths.documentsDir ??
            "";
        workspaceFs = await invoke<WorkspacePaths>("workspace_paths", {
            path: config.active_tenant,
        }).catch(() => null);
    }

    async function saveWorkspaceSettings() {
        workspaceSaving = true;
        workspaceSaved = false;
        workspaceError = "";
        try {
            const nextProfile = {
                ...config.profile,
                payment_days:
                    Number.parseInt(workspacePaymentDays, 10) ||
                    config.profile.payment_days,
                invoice_number_prefix:
                    workspaceInvoicePrefix.trim() ||
                    config.profile.invoice_number_prefix,
                invoice_number_counter: invoiceCounterReset
                    ? 1
                    : config.profile.invoice_number_counter,
            };
            const nextTenants = config.tenants.map((tenant) =>
                tenant.path === config.active_tenant
                    ? {
                          ...tenant,
                          name: workspaceName.trim() || tenant.name,
                          displayName:
                              workspaceName.trim() || tenant.displayName,
                      }
                    : tenant,
            );

            await saveAppConfig({
                ...config,
                tenants: nextTenants,
                profile: nextProfile,
                default_workspace_dir: defaultWorkspaceDir || null,
                default_export_dir: defaultExportDir || null,
            });

            if (isTauriAvailable() && config.active_tenant) {
                await metaSet(
                    "tenant.name",
                    workspaceName.trim() || activeTenant?.name || "Workspace",
                );
                await metaSet(
                    "tenant.display_name",
                    workspaceName.trim() || activeTenant?.name || "Workspace",
                );
                if (workspaceType.trim()) {
                    await metaSet("tenant.type", workspaceType.trim());
                }
                await metaSet(
                    "defaults.currency",
                    workspaceCurrency.trim() || "EUR",
                );
                await metaSet(
                    "defaults.payment_term_days",
                    String(Number.parseInt(workspacePaymentDays, 10) || 14),
                );
                await metaSet(
                    "defaults.invoice_prefix",
                    workspaceInvoicePrefix.trim() || "RE",
                );
            }

            invoiceCounterReset = false;
            workspaceSaved = true;
            setTimeout(() => (workspaceSaved = false), 2500);
            config = appConfigStore.get()!;
            await loadWorkspaceSettings();
        } catch (e) {
            workspaceError = String(e);
        } finally {
            workspaceSaving = false;
        }
    }

    async function addTenant() {
        errorMsg = "";
        try {
            if (!tenantName.trim()) {
                errorMsg = "Bitte gib einen Namen für den Arbeitsbereich an.";
                return;
            }
            if (!tenantDir.trim()) {
                errorMsg = "Bitte wähle zuerst einen Projektordner.";
                return;
            }
            const path = `${tenantDir}/etasks.sqlite3`;
            await activateTenant(path, tenantName.trim());
            await writeTenantMeta(tenantName.trim());
            config = appConfigStore.get()!;
            tenantName = "";
            tenantDir = "";
            addingTenant = false;
        } catch (e) {
            errorMsg = String(e);
        }
    }

    async function pickTenantDirectory() {
        errorMsg = "";
        try {
            const dir = await invoke<string | null>("pick_directory", {
                defaultPath:
                    tenantDir ||
                    defaultWorkspaceDir ||
                    appPaths.documentsDir ||
                    appPaths.appDataDir ||
                    null,
            });
            if (dir) tenantDir = dir;
        } catch (e) {
            errorMsg = String(e);
        }
    }

    async function pickDefaultWorkspaceDirectory() {
        workspaceError = "";
        try {
            const dir = await invoke<string | null>("pick_directory", {
                defaultPath:
                    defaultWorkspaceDir ||
                    appPaths.documentsDir ||
                    appPaths.appDataDir ||
                    null,
            });
            if (dir) defaultWorkspaceDir = dir;
        } catch (e) {
            workspaceError = String(e);
        }
    }

    async function pickDefaultExportDirectory() {
        workspaceError = "";
        try {
            const dir = await invoke<string | null>("pick_directory", {
                defaultPath:
                    defaultExportDir ||
                    appPaths.downloadsDir ||
                    appPaths.documentsDir ||
                    null,
            });
            if (dir) defaultExportDir = dir;
        } catch (e) {
            workspaceError = String(e);
        }
    }

    async function switchTenant(path: string) {
        if (path === config.active_tenant) return;
        errorMsg = "";
        try {
            await activateTenant(path);
            config = appConfigStore.get()!;
            await loadWorkspaceSettings();
        } catch (e) {
            errorMsg = String(e);
        }
    }
</script>

<section class="panel-section flex flex-col gap-4">
    <div
        class="flex items-start justify-between gap-4 border-b border-border pb-2"
    >
        <div>
            <h2 class="text-base font-semibold text-primary">
                Aktiver Arbeitsbereich
            </h2>
            <p class="mt-1 text-sm text-secondary">
                Standardwerte und Metadaten fuer Rechnungen und
                Restore-Ziele.
            </p>
        </div>
        {#if activeTenant}
            <span class="pill">Aktiv</span>
        {/if}
    </div>

    <div class="grid grid-cols-2 gap-3">
        <label class="flex flex-col gap-1 col-span-2">
            <span class="text-xs text-muted font-medium"
                >Anzeigename</span
            >
            <input
                class="input"
                bind:value={workspaceName}
                placeholder="z. B. Freelance 2026"
            />
        </label>
        <label class="flex flex-col gap-1">
            <span class="text-xs text-muted font-medium">Typ</span>
            <input
                class="input"
                bind:value={workspaceType}
                placeholder="z. B. freelance"
            />
        </label>
        <label class="flex flex-col gap-1">
            <span class="text-xs text-muted font-medium">Waehrung</span>
            <input
                class="input font-mono"
                bind:value={workspaceCurrency}
                maxlength="3"
                placeholder="EUR"
            />
        </label>
        <label class="flex flex-col gap-1">
            <span class="text-xs text-muted font-medium">
                Standard-Zahlungsziel
            </span>
            <input
                class="input"
                type="number"
                bind:value={workspacePaymentDays}
                placeholder="14"
            />
        </label>
        <label class="flex flex-col gap-1">
            <span class="text-xs text-muted font-medium">
                Standard-Rechnungspraefix
            </span>
            <input
                class="input font-mono"
                bind:value={workspaceInvoicePrefix}
                placeholder="RE"
            />
        </label>
    </div>

    <div class="rounded-2xl border border-border bg-white/55 px-4 py-3">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div class="flex flex-col gap-1">
                <span
                    class="text-xs uppercase tracking-[0.08em] text-muted"
                >
                    Arbeitsbereich
                </span>
                <span class="text-primary break-all">
                    {workspaceFs?.workspaceDir ?? activeTenant?.path ?? "Browser-Modus"}
                </span>
            </div>
            <div class="flex flex-col gap-1">
                <span
                    class="text-xs uppercase tracking-[0.08em] text-muted"
                >
                    Datenbank
                </span>
                <span class="text-primary break-all">
                    {workspaceFs?.databasePath ?? activeTenant?.path ?? "Nicht verfuegbar"}
                </span>
            </div>
            <div class="flex flex-col gap-1">
                <span
                    class="text-xs uppercase tracking-[0.08em] text-muted"
                >
                    Angelegt
                </span>
                <span class="text-primary">
                    {workspaceCreatedAt
                        ? new Date(workspaceCreatedAt).toLocaleString(
                              "de-DE",
                          )
                        : "Nicht verfuegbar"}
                </span>
            </div>
            <div class="flex flex-col gap-1">
                <span
                    class="text-xs uppercase tracking-[0.08em] text-muted"
                >
                    Assets
                </span>
                <span class="text-primary break-all">
                    {workspaceFs?.assetsDir ?? "Nicht verfuegbar"}
                </span>
            </div>
        </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label class="flex flex-col gap-1">
            <span class="text-xs text-muted font-medium">
                Standardordner neue Arbeitsbereiche
            </span>
            <div class="flex items-center gap-2">
                <input class="input" bind:value={defaultWorkspaceDir} placeholder={appPaths.documentsDir ?? "Ordner"} />
                <button class="secondary-button whitespace-nowrap" on:click={pickDefaultWorkspaceDirectory} disabled={!isTauriAvailable()}>
                    Ordner waehlen
                </button>
            </div>
        </label>
        <label class="flex flex-col gap-1">
            <span class="text-xs text-muted font-medium">
                Standardordner Exporte & PDFs
            </span>
            <div class="flex items-center gap-2">
                <input class="input" bind:value={defaultExportDir} placeholder={appPaths.downloadsDir ?? "Ordner"} />
                <button class="secondary-button whitespace-nowrap" on:click={pickDefaultExportDirectory} disabled={!isTauriAvailable()}>
                    Ordner waehlen
                </button>
            </div>
        </label>
    </div>

    <label
        class="inline-flex items-center gap-2 text-sm text-secondary"
    >
        <input type="checkbox" bind:checked={invoiceCounterReset} />
        <span
            >Rechnungszaehler beim Speichern auf `1` zuruecksetzen</span
        >
    </label>

    <div class="flex items-center gap-3">
        <button
            class="primary-button"
            on:click={saveWorkspaceSettings}
            disabled={workspaceSaving}
        >
            {workspaceSaving
                ? "Arbeitsbereich speichern…"
                : "Arbeitsbereich speichern"}
        </button>
        {#if workspaceSaved}
            <span class="text-xs text-green-500">Gespeichert ✓</span>
        {/if}
    </div>

    {#if workspaceError}
        <p class="text-xs text-red-500">{workspaceError}</p>
    {/if}
</section>

<section class="panel-section flex flex-col gap-4">
    <h2
        class="text-base font-semibold text-primary border-b border-border pb-2"
    >
        App-Hinweise
    </h2>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div class="info-card">
            <span class="info-card__label">Modus</span>
            <strong class="info-card__value">
                {isTauriAvailable() ? "Desktop-App" : "Browser"}
            </strong>
            <p class="info-card__text">
                {isTauriAvailable()
                    ? "Lokale Datenbank, PDF-Export und Snapshots sind aktiv."
                    : "Ohne lokalen Workspace, PDFs und Snapshots laufen hier nicht."}
            </p>
        </div>
        <div class="info-card">
            <span class="info-card__label">Kurzbefehle</span>
            <strong class="info-card__value">Cmd/Ctrl + K</strong>
            <p class="info-card__text">
                Oeffnet die Schnellanlage fuer Aufgaben und Eintraege.
            </p>
        </div>
        <div class="info-card">
            <span class="info-card__label">Version</span>
            <strong class="info-card__value"
                >Schema {config.version}</strong
            >
            <p class="info-card__text">
                Aktive App-Konfiguration mit Tenant-Liste und
                Profilstatus.
            </p>
        </div>
    </div>
</section>

<section class="panel-section flex flex-col gap-4">
    <h2
        class="text-base font-semibold text-primary border-b border-border pb-2"
    >
        Arbeitsbereiche
    </h2>

    <ul class="flex flex-col gap-2">
        {#each config.tenants as tenant}
            <li
                class="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border {tenant.path ===
                config.active_tenant
                    ? 'border-accent bg-accent/5'
                    : 'border-border bg-bg'}"
            >
                <div class="flex flex-col gap-0.5 min-w-0">
                    <span class="text-sm font-medium text-primary"
                        >{tenant.name}</span
                    >
                    <span class="text-xs text-muted truncate"
                        >{tenant.path}</span
                    >
                </div>
                {#if tenant.path === config.active_tenant}
                    <span
                        class="text-xs text-accent font-medium flex-shrink-0"
                        >Aktiv</span
                    >
                {:else}
                    <div class="flex items-center gap-1 flex-shrink-0">
                        <button
                            class="secondary-button text-xs"
                            on:click={() => switchTenant(tenant.path)}
                        >
                            Wechseln
                        </button>
                        <button
                            class="text-xs text-muted hover:text-red-500 px-2 py-1 transition-colors"
                            title="Aus Liste entfernen"
                            on:click={() => removeTenant(tenant.path)}
                            >×</button
                        >
                    </div>
                {/if}
            </li>
        {/each}
    </ul>

    {#if addingTenant}
        <div
            class="rounded-2xl border border-border bg-white/60 p-4 flex flex-col gap-3 shadow-[0_1px_0_rgba(255,255,255,0.75)_inset]"
        >
            <label class="flex flex-col gap-1">
                <span class="text-xs text-muted font-medium">Name</span>
                <input
                    class="input"
                    bind:value={tenantName}
                    placeholder="z. B. Freelance 2026"
                />
            </label>

            <div class="flex flex-col gap-1">
                <span class="text-xs text-muted font-medium"
                    >Projektordner</span
                >
                <div class="flex items-center gap-2">
                    <button
                        class="secondary-button"
                        on:click={pickTenantDirectory}
                        disabled={!isTauriAvailable()}
                    >
                        Ordner wählen
                    </button>
                    <span class="text-xs text-muted truncate"
                        >{tenantDir || "Noch kein Projektordner gewählt"}</span
                    >
                </div>
            </div>

            <div class="flex items-center gap-2">
                <button
                    class="primary-button"
                    on:click={addTenant}
                    disabled={!isTauriAvailable()}
                >
                    Arbeitsbereich anlegen
                </button>
                <button
                    class="secondary-button"
                    on:click={() => {
                        addingTenant = false;
                        tenantName = "";
                        tenantDir = "";
                        errorMsg = "";
                    }}
                >
                    Abbrechen
                </button>
            </div>
        </div>
    {:else}
        <button
            class="self-start flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-white/60 text-secondary text-sm hover:bg-white hover:text-primary transition-colors shadow-[0_1px_0_rgba(255,255,255,0.75)_inset]"
            on:click={() => {
                addingTenant = true;
                errorMsg = "";
            }}
        >
            <span>+</span>
            <span>Neuen Arbeitsbereich hinzufügen</span>
        </button>
    {/if}

    {#if errorMsg}
        <p class="text-xs text-red-500">{errorMsg}</p>
    {/if}
</section>

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
    .pill {
        padding: 5px 10px;
        border-radius: 999px;
        background: rgba(10, 132, 255, 0.1);
        color: var(--color-accent);
        font-size: 12px;
        font-weight: 600;
    }
    .input {
        width: 100%;
        padding: 8px 11px;
        background: rgba(255, 255, 255, 0.72);
        border: 1px solid var(--color-border);
        border-radius: 12px;
        color: var(--color-text-primary);
        font-size: 13px;
        outline: none;
        transition:
            border-color 0.15s,
            background 0.15s,
            box-shadow 0.15s;
    }
    .input:focus {
        border-color: var(--color-accent);
        background: rgba(255, 255, 255, 0.92);
        box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.12);
    }
    .primary-button {
        padding: 10px 16px;
        border-radius: 14px;
        background: linear-gradient(180deg, #0a84ff, #0066d6);
        color: white;
        font-size: 13px;
        font-weight: 600;
        transition:
            opacity 0.15s,
            transform 0.15s,
            box-shadow 0.15s;
        box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.25) inset,
            0 8px 18px rgba(0, 102, 214, 0.24);
    }
    .primary-button:hover:not(:disabled) {
        transform: translateY(-1px);
    }
    .primary-button:disabled {
        opacity: 0.4;
    }
    .secondary-button {
        padding: 8px 12px;
        border-radius: 12px;
        border: 1px solid var(--color-border);
        background: rgba(255, 255, 255, 0.66);
        color: var(--color-text-secondary);
        font-size: 13px;
        transition:
            background 0.15s,
            color 0.15s,
            border-color 0.15s;
    }
    .secondary-button:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.92);
        color: var(--color-text-primary);
        border-color: color-mix(in srgb, var(--color-accent) 55%, white);
    }
    .secondary-button:disabled {
        opacity: 0.45;
    }
    .info-card {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 14px;
        border: 1px solid var(--color-border);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.62);
    }
    .info-card__label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-text-muted);
    }
    .info-card__value {
        font-size: 14px;
        color: var(--color-text-primary);
    }
    .info-card__text {
        font-size: 12px;
        line-height: 1.45;
        color: var(--color-text-secondary);
    }
</style>
