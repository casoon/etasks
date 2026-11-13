<!-- @core -->
<script lang="ts">
    import { onMount } from "svelte";
    import { command } from "@casoon/origin-client";
    import {
        $appConfig as appConfigStore,
        saveAppConfig,
        writeTenantMeta,
        removeTenant,
    } from "../../stores/configStore";
    import { activateTenant, tenantDbExists } from "../../lib/appBootstrap";
    import { toast } from "../../stores/toastStore";
    import { metaGet, metaSet } from "../../lib/metaStore";
    import { $invoices as invoicesStore } from "../../stores/invoiceStore";
    import {
        formatInvoiceNumber,
        peekInvoiceCounter,
        setInvoiceCounter,
        validateInvoiceCounterStart,
    } from "../../lib/invoiceNumber";
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
    let workspacePaymentDays = "14";
    let workspaceInvoicePrefix = "RE";
    let workspaceCreatedAt = "";
    let workspaceSaving = false;
    let workspaceSaved = false;
    let workspaceError = "";
    let invoiceCounterReset = false;
    let nextInvoiceCounter = "1";
    let loadedInvoiceCounter = "1";
    let invoiceCounterError = "";
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
            appPaths = await command<AppPaths>("app_paths").catch(() => ({}));
        }
        await loadWorkspaceSettings();
    });

    $: invoicePrefix = workspaceInvoicePrefix.trim() || "RE-";
    const existingInvoiceNumbers = () =>
        invoicesStore.get().map((i) => i.invoiceNumber);

    async function loadWorkspaceSettings() {
        invoiceCounterError = "";
        loadedInvoiceCounter = nextInvoiceCounter = String(
            await peekInvoiceCounter(
                config.profile.invoice_number_prefix?.trim() || "RE-",
                config.profile.invoice_number_counter,
                existingInvoiceNumbers(),
            ),
        );
        workspaceError = "";
        workspaceSaved = false;
        workspaceName = activeTenant?.name ?? "";
        // Zahlungsziel und Rechnungspräfix gehören dem Profil (eine Quelle).
        workspacePaymentDays = String(config.profile.payment_days ?? 14);
        workspaceInvoicePrefix = config.profile.invoice_number_prefix ?? "";

        if (!isTauriAvailable() || !config.active_tenant) {
            workspaceCreatedAt = "";
            defaultWorkspaceDir = config.default_workspace_dir ?? "";
            defaultExportDir = config.default_export_dir ?? "";
            workspaceFs = null;
            return;
        }

        workspaceName =
            (await metaGet("tenant.display_name")) ?? activeTenant?.name ?? "";
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
        workspaceFs = await command<WorkspacePaths>("workspace_paths", {
            path: config.active_tenant,
        }).catch(() => null);
    }

    async function saveWorkspaceSettings() {
        workspaceSaved = false;
        workspaceError = "";
        invoiceCounterError = "";
        const counterValue = Number(nextInvoiceCounter);
        const counterChanged =
            !invoiceCounterReset &&
            String(nextInvoiceCounter) !== loadedInvoiceCounter;
        if (counterChanged) {
            invoiceCounterError = validateInvoiceCounterStart(
                invoicePrefix,
                counterValue,
                existingInvoiceNumbers(),
            );
            if (invoiceCounterError) return;
        }
        workspaceSaving = true;
        try {
            const nextProfile = {
                ...config.profile,
                payment_days:
                    Number.parseInt(workspacePaymentDays, 10) ||
                    config.profile.payment_days,
                invoice_number_prefix:
                    workspaceInvoicePrefix.trim() ||
                    config.profile.invoice_number_prefix,
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

            if (invoiceCounterReset) await setInvoiceCounter(1);
            else if (counterChanged) await setInvoiceCounter(counterValue);

            if (isTauriAvailable() && config.active_tenant) {
                await metaSet(
                    "tenant.name",
                    workspaceName.trim() || activeTenant?.name || "Workspace",
                );
                await metaSet(
                    "tenant.display_name",
                    workspaceName.trim() || activeTenant?.name || "Workspace",
                );
            }

            invoiceCounterReset = false;
            config = appConfigStore.get()!;
            await loadWorkspaceSettings();
            workspaceSaved = true;
            setTimeout(() => (workspaceSaved = false), 2500);
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
                errorMsg = "Bitte wähle zuerst einen Ordner.";
                return;
            }
            // Eigener Unterordner pro Arbeitsbereich; ein vorhandener Ordner wird nie wiederverwendet.
            const path = await command<string>("default_tenant_path", {
                tenantName: tenantName.trim(),
                baseDir: tenantDir,
            });
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
            const dir = await command<string | null>("pick_directory", {
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
            const dir = await command<string | null>("pick_directory", {
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
            const dir = await command<string | null>("pick_directory", {
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
            if (!(await tenantDbExists(path))) {
                toast(
                    "Die Datenbank dieses Arbeitsbereichs wurde nicht gefunden. Wurde der Ordner verschoben oder gelöscht?",
                    "error",
                    6000,
                );
                return;
            }
            await activateTenant(path);
            config = appConfigStore.get()!;
            await loadWorkspaceSettings();
        } catch (e) {
            errorMsg = String(e);
        }
    }
</script>

<section class="et-card p-5 flex flex-col gap-4">
    <div
        class="flex items-start justify-between gap-4 "
    >
        <div>
            <h2 class="et-h2">
                Aktiver Arbeitsbereich
            </h2>
            <p class="mt-1 text-sm text-[var(--et-text-3)]">
                Standardwerte und Metadaten für Rechnungen und
                Restore-Ziele.
            </p>
        </div>
        {#if activeTenant}
            <span class="et-badge et-badge-blue">Aktiv</span>
        {/if}
    </div>

    <div class="grid grid-cols-2 gap-3">
        <label class="flex flex-col gap-1 col-span-2">
            <span class="et-label"
                >Anzeigename</span
            >
            <input
                class="et-field"
                bind:value={workspaceName}
                placeholder="z. B. Freelance 2026"
            />
        </label>
        <label class="flex flex-col gap-1">
            <span class="et-label">
                Standard-Zahlungsziel
            </span>
            <input
                class="et-field"
                type="number"
                bind:value={workspacePaymentDays}
                placeholder="14"
            />
        </label>
        <label class="flex flex-col gap-1">
            <span class="et-label">
                Standard-Rechnungspräfix
            </span>
            <input
                class="et-field font-mono"
                bind:value={workspaceInvoicePrefix}
                placeholder="RE"
            />
        </label>
    </div>

    <div class="rounded-[12px] border border-[var(--et-border)] bg-[var(--et-surface-sunken)] px-4 py-3">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div class="flex flex-col gap-1">
                <span
                    class="text-xs uppercase tracking-[0.08em] text-[var(--et-text-3)]"
                >
                    Arbeitsbereich
                </span>
                <span class="text-[var(--et-text)] break-all">
                    {workspaceFs?.workspaceDir ?? activeTenant?.path ?? "Browser-Modus"}
                </span>
            </div>
            <div class="flex flex-col gap-1">
                <span
                    class="text-xs uppercase tracking-[0.08em] text-[var(--et-text-3)]"
                >
                    Datenbank
                </span>
                <span class="text-[var(--et-text)] break-all">
                    {workspaceFs?.databasePath ?? activeTenant?.path ?? "Nicht verfügbar"}
                </span>
            </div>
            <div class="flex flex-col gap-1">
                <span
                    class="text-xs uppercase tracking-[0.08em] text-[var(--et-text-3)]"
                >
                    Angelegt
                </span>
                <span class="text-[var(--et-text)]">
                    {workspaceCreatedAt
                        ? new Date(workspaceCreatedAt).toLocaleString(
                              "de-DE",
                          )
                        : "Nicht verfügbar"}
                </span>
            </div>
            <div class="flex flex-col gap-1">
                <span
                    class="text-xs uppercase tracking-[0.08em] text-[var(--et-text-3)]"
                >
                    Assets
                </span>
                <span class="text-[var(--et-text)] break-all">
                    {workspaceFs?.assetsDir ?? "Nicht verfügbar"}
                </span>
            </div>
        </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label class="flex flex-col gap-1">
            <span class="et-label">
                Standardordner neue Arbeitsbereiche
            </span>
            <div class="flex items-center gap-2">
                <input class="et-field" bind:value={defaultWorkspaceDir} placeholder={appPaths.documentsDir ?? "Ordner"} />
                <button class="et-btn" on:click={pickDefaultWorkspaceDirectory} disabled={!isTauriAvailable()}>
                    Ordner wählen
                </button>
            </div>
        </label>
        <label class="flex flex-col gap-1">
            <span class="et-label">
                Standardordner Exporte & PDFs
            </span>
            <div class="flex items-center gap-2">
                <input class="et-field" bind:value={defaultExportDir} placeholder={appPaths.downloadsDir ?? "Ordner"} />
                <button class="et-btn" on:click={pickDefaultExportDirectory} disabled={!isTauriAvailable()}>
                    Ordner wählen
                </button>
            </div>
        </label>
    </div>

    <label class="flex flex-col gap-1 max-w-xs">
        <span class="et-label">Nächste Rechnungsnummer</span>
        <input
            class="et-field font-mono"
            type="number"
            min="1"
            step="1"
            bind:value={nextInvoiceCounter}
            disabled={invoiceCounterReset}
        />
        <span class="text-[12px] text-[var(--et-text-3)]">
            Nächste Nummer: {formatInvoiceNumber(invoicePrefix, Number(nextInvoiceCounter) || 1)}
            · gilt nur für diesen Arbeitsbereich, nie unter bereits vergebenen Nummern
        </span>
        {#if invoiceCounterError}
            <span class="text-[12px] text-[var(--et-danger)]">{invoiceCounterError}</span>
        {/if}
    </label>

    <label
        class="inline-flex items-center gap-2 min-h-[44px] text-sm text-[var(--et-text-3)]"
    >
        <input type="checkbox" bind:checked={invoiceCounterReset} />
        <span
            >Rechnungszähler dieses Arbeitsbereichs beim Speichern auf 1
            zurücksetzen (bereits vergebene Nummern werden nicht erneut
            vergeben)</span
        >
    </label>

    <div class="flex items-center gap-3">
        <button
            class="et-btn et-btn-primary"
            on:click={saveWorkspaceSettings}
            disabled={workspaceSaving}
        >
            {workspaceSaving
                ? "Arbeitsbereich speichern…"
                : "Arbeitsbereich speichern"}
        </button>
        {#if workspaceSaved}
            <span class="text-[13px] text-[var(--et-success-text)]">Gespeichert</span>
        {/if}
    </div>

    {#if workspaceError}
        <p class="text-[13px] text-[var(--et-danger)]">{workspaceError}</p>
    {/if}
</section>

<section class="et-card p-5 flex flex-col gap-4">
    <h2
        class="et-h2"
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
            <strong class="info-card__value">Cmd/Strg + K</strong>
            <p class="info-card__text">
                Öffnet die Schnellanlage für Aufgaben und Einträge.
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

<section class="et-card p-5 flex flex-col gap-4">
    <h2
        class="et-h2"
    >
        Arbeitsbereiche
    </h2>

    <ul class="flex flex-col gap-2">
        {#each config.tenants as tenant}
            <li
                class="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border {tenant.path ===
                config.active_tenant
                    ? 'border-[var(--et-accent)] bg-[var(--et-accent-soft)]'
                    : 'border-[var(--et-border)] bg-[var(--et-surface-sunken)]'}"
            >
                <div class="flex flex-col gap-0.5 min-w-0">
                    <span class="text-sm font-medium text-[var(--et-text)]"
                        >{tenant.name}</span
                    >
                    <span class="text-xs text-[var(--et-text-3)] truncate"
                        >{tenant.path}</span
                    >
                </div>
                {#if tenant.path === config.active_tenant}
                    <span
                        class="text-[13px] font-semibold text-[var(--et-accent-strong)] flex-shrink-0"
                        >Aktiv</span
                    >
                {:else}
                    <div class="flex items-center gap-1 flex-shrink-0">
                        <button
                            class="et-btn et-btn-sm"
                            on:click={() => switchTenant(tenant.path)}
                        >
                            Wechseln
                        </button>
                        <button
                            class="et-btn et-btn-sm et-btn-icon et-btn-ghost"
                            aria-label="{tenant.name} aus der Liste entfernen"
                            title="Aus Liste entfernen"
                            on:click={() => removeTenant(tenant.path)}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>
                        </button>
                    </div>
                {/if}
            </li>
        {/each}
    </ul>

    {#if addingTenant}
        <div
            class="rounded-[12px] border border-[var(--et-border)] bg-[var(--et-surface-sunken)] p-4 flex flex-col gap-3"
        >
            <label class="flex flex-col gap-1">
                <span class="et-label">Name</span>
                <input
                    class="et-field"
                    bind:value={tenantName}
                    placeholder="z. B. Freelance 2026"
                />
            </label>

            <div class="flex flex-col gap-1">
                <span class="et-label"
                    >Übergeordneter Ordner (darin entsteht ein eigener Unterordner)</span
                >
                <div class="flex items-center gap-2">
                    <button
                        class="et-btn"
                        on:click={pickTenantDirectory}
                        disabled={!isTauriAvailable()}
                    >
                        Ordner wählen
                    </button>
                    <span class="text-xs text-[var(--et-text-3)] truncate"
                        >{tenantDir || "Noch kein Ordner gewählt"}</span
                    >
                </div>
            </div>

            <div class="flex items-center gap-2">
                <button
                    class="et-btn et-btn-primary"
                    on:click={addTenant}
                    disabled={!isTauriAvailable()}
                >
                    Arbeitsbereich anlegen
                </button>
                <button
                    class="et-btn"
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
            class="et-btn self-start"
            on:click={() => {
                addingTenant = true;
                errorMsg = "";
            }}
        >
            <span aria-hidden="true">+</span>
            <span>Neuen Arbeitsbereich hinzufügen</span>
        </button>
    {/if}

    {#if errorMsg}
        <p class="text-[13px] text-[var(--et-danger)]">{errorMsg}</p>
    {/if}
</section>

<style>
    .info-card {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 14px;
        border: 1px solid var(--et-border);
        border-radius: var(--et-radius-xl);
        background: var(--et-surface-sunken);
    }
    .info-card__label {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--et-text-3);
    }
    .info-card__value {
        font-size: 14px;
        color: var(--et-text);
    }
    .info-card__text {
        font-size: 12px;
        line-height: 1.45;
        color: var(--et-text-3);
    }
</style>
