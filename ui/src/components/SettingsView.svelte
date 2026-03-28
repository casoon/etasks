<script lang="ts">
    import { onMount } from "svelte";
    import { convertFileSrc, invoke } from "@tauri-apps/api/core";
    import {
        $appConfig as appConfigStore,
        saveAppConfig,
        writeTenantMeta,
        removeTenant,
    } from "../stores/configStore";
    import { activateTenant } from "../lib/appBootstrap";
    import {
        runExportWithFeedback,
        runSnapshotWithFeedback,
        restoreFromBackupFile,
    } from "../lib/backupActions";
    import { metaGet, metaSet } from "../lib/metaStore";
    import { isTauriAvailable } from "../lib/platform";
    import type { AppConfig, UserProfile } from "../stores/configStore";

    let config = appConfigStore.get();
    let profile: UserProfile = { ...config.profile };
    let saved = false;
    let saving = false;
    let errorMsg = "";
    let addingTenant = false;
    let tenantName = "";
    let tenantDir = "";
    let importInput: HTMLInputElement | null = null;
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
    type SettingsSection = "profil" | "arbeitsbereich" | "daten";
    let activeSection: SettingsSection = "profil";
    let logoImporting = false;
    let logoPreviewError = false;

    $: activeTenant = config.tenants.find(
        (tenant) => tenant.path === config.active_tenant,
    );
    $: logoPreviewUrl =
        isTauriAvailable() && profile.logo?.trim()
            ? convertFileSrc(profile.logo)
            : profile.logo?.trim() || "";
    $: invoicePrefixPreview = buildNumberPreview(
        profile.invoice_number_prefix,
        profile.invoice_number_counter,
        "RE-",
    );
    $: offerPrefixPreview = buildNumberPreview(
        profile.offer_number_prefix,
        profile.offer_number_counter,
        "ANG-",
    );
    $: invoicePrefixError = validatePrefix(profile.invoice_number_prefix);
    $: offerPrefixError = validatePrefix(profile.offer_number_prefix);

    appConfigStore.subscribe((c) => {
        if (c) {
            config = c;
            profile = { ...c.profile };
        }
    });

    onMount(async () => {
        await loadWorkspaceSettings();
    });

    async function saveProfile() {
        saving = true;
        saved = false;
        errorMsg = "";
        try {
            if (invoicePrefixError || offerPrefixError) {
                errorMsg =
                    invoicePrefixError ||
                    offerPrefixError ||
                    "Bitte prüfe die Nummernkreise.";
                saving = false;
                return;
            }
            await saveAppConfig({ ...config, profile });
            saved = true;
            setTimeout(() => (saved = false), 2500);
        } catch (e) {
            errorMsg = String(e);
        } finally {
            saving = false;
        }
    }

    async function importLogo() {
        if (!isTauriAvailable()) return;
        logoImporting = true;
        errorMsg = "";
        try {
            const imported = await invoke<string | null>("import_logo_file");
            if (imported) {
                profile.logo = imported;
                logoPreviewError = false;
            }
        } catch (e) {
            errorMsg = String(e);
        } finally {
            logoImporting = false;
        }
    }

    function buildNumberPreview(
        prefix: string | undefined,
        counter: number | undefined,
        fallback: string,
    ) {
        return `${prefix?.trim() || fallback}${String(counter ?? 1).padStart(3, "0")}`;
    }

    function validatePrefix(prefix: string | undefined) {
        const value = prefix?.trim() ?? "";
        if (!value) return "";
        if (value.length < 2) {
            return "Praefix sollte mindestens 2 Zeichen haben.";
        }
        if (!/^[A-Za-z0-9-_/]+$/.test(value)) {
            return "Praefix enthaelt ungueltige Zeichen.";
        }
        return "";
    }

    async function addTenant() {
        errorMsg = "";
        try {
            if (!tenantName.trim()) {
                errorMsg = "Bitte gib einen Namen für den Arbeitsbereich an.";
                return;
            }
            if (!tenantDir.trim()) {
                errorMsg = "Bitte wähle zuerst einen Zielordner.";
                return;
            }
            const slug = tenantName
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "");
            const path = tenantDir + "/" + slug + ".db";
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
            const dir = await invoke<string | null>("pick_directory");
            if (dir) tenantDir = dir;
        } catch (e) {
            errorMsg = String(e);
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

    async function loadWorkspaceSettings() {
        workspaceError = "";
        workspaceSaved = false;
        workspaceName = activeTenant?.name ?? "";

        if (!isTauriAvailable() || !config.active_tenant) {
            workspaceType = "browser";
            workspaceCurrency = "EUR";
            workspacePaymentDays = String(profile.payment_days ?? 14);
            workspaceInvoicePrefix = profile.invoice_number_prefix ?? "RE";
            workspaceCreatedAt = "";
            return;
        }

        workspaceName =
            (await metaGet("tenant.display_name")) ?? activeTenant?.name ?? "";
        workspaceType = (await metaGet("tenant.type")) ?? "";
        workspaceCurrency = (await metaGet("defaults.currency")) ?? "EUR";
        workspacePaymentDays =
            (await metaGet("defaults.payment_term_days")) ??
            String(profile.payment_days ?? 14);
        workspaceInvoicePrefix =
            (await metaGet("defaults.invoice_prefix")) ??
            profile.invoice_number_prefix ??
            "RE";
        workspaceCreatedAt = (await metaGet("app.created_at")) ?? "";
    }

    async function saveWorkspaceSettings() {
        workspaceSaving = true;
        workspaceSaved = false;
        workspaceError = "";
        try {
            const nextProfile: UserProfile = {
                ...profile,
                payment_days:
                    Number.parseInt(workspacePaymentDays, 10) ||
                    profile.payment_days,
                invoice_number_prefix:
                    workspaceInvoicePrefix.trim() ||
                    profile.invoice_number_prefix,
                invoice_number_counter: invoiceCounterReset
                    ? 1
                    : profile.invoice_number_counter,
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
            });
            profile = { ...nextProfile };

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
            await loadWorkspaceSettings();
        } catch (e) {
            workspaceError = String(e);
        } finally {
            workspaceSaving = false;
        }
    }

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

<div class="flex-1 overflow-y-auto p-6 flex flex-col gap-8 max-w-3xl">
    <section
        class="sticky top-0 z-10 flex flex-col gap-3 rounded-3xl border border-border bg-white/75 p-4 backdrop-blur-xl shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
    >
        <div class="flex items-start justify-between gap-4">
            <div>
                <h1 class="text-lg font-semibold text-primary">
                    Einstellungen
                </h1>
                <p class="mt-1 text-sm text-secondary">
                    {isTauriAvailable()
                        ? "Desktop-Modus mit lokalem Workspace, PDFs und Snapshots."
                        : "Browser-Modus ohne lokale Dateifunktionen. Daten bleiben im Browser-Kontext."}
                </p>
            </div>
            <span class="pill">
                {isTauriAvailable() ? "Desktop" : "Browser"}
            </span>
        </div>

        <div class="section-tabs">
            <button
                class:section-tab-active={activeSection === "profil"}
                class="section-tab"
                on:click={() => (activeSection = "profil")}
            >
                Profil
            </button>
            <button
                class:section-tab-active={activeSection === "arbeitsbereich"}
                class="section-tab"
                on:click={() => (activeSection = "arbeitsbereich")}
            >
                Arbeitsbereich
            </button>
            <button
                class:section-tab-active={activeSection === "daten"}
                class="section-tab"
                on:click={() => (activeSection = "daten")}
            >
                Daten & Backups
            </button>
        </div>
    </section>

    {#if activeSection === "profil"}
        <!-- Profile section -->
        <section class="panel-section flex flex-col gap-4">
            <h2
                class="text-base font-semibold text-primary border-b border-border pb-2"
            >
                Profil
            </h2>

            <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                    <span class="text-xs text-muted font-medium">Vorname</span>
                    <input class="input" bind:value={profile.first_name} />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="text-xs text-muted font-medium">Nachname</span>
                    <input class="input" bind:value={profile.last_name} />
                </label>
                <label class="flex flex-col gap-1 col-span-2">
                    <span class="text-xs text-muted font-medium">E-Mail</span>
                    <input
                        class="input"
                        type="email"
                        bind:value={profile.email}
                    />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="text-xs text-muted font-medium">Telefon</span>
                    <input class="input" bind:value={profile.phone} />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="text-xs text-muted font-medium">Webseite</span>
                    <input
                        class="input"
                        bind:value={profile.website}
                        placeholder="www.example.com"
                    />
                </label>
                <label class="flex flex-col gap-1 col-span-2">
                    <span class="text-xs text-muted font-medium"
                        >Unternehmen</span
                    >
                    <input class="input" bind:value={profile.company} />
                </label>
                <div
                    class="col-span-2 rounded-2xl border border-border bg-white/55 p-4"
                >
                    <div class="flex items-center justify-between gap-3">
                        <div class="min-w-0">
                            <p class="text-xs font-medium text-muted">
                                Dokumenten-Logo
                            </p>
                            <p class="mt-1 text-sm text-primary truncate">
                                {profile.logo || "Noch kein Logo hinterlegt"}
                            </p>
                        </div>
                        <button
                            class="secondary-button"
                            on:click={importLogo}
                            disabled={!isTauriAvailable() || logoImporting}
                        >
                            {logoImporting ? "Import…" : "Logo waehlen"}
                        </button>
                    </div>
                    <div
                        class="mt-3 grid grid-cols-1 md:grid-cols-[1fr_120px] gap-3"
                    >
                        <label class="flex flex-col gap-1">
                            <span class="text-xs text-muted font-medium">
                                Dateipfad
                            </span>
                            <input
                                class="input font-mono"
                                bind:value={profile.logo}
                                placeholder="/Users/.../company-logo.png"
                                on:input={() => {
                                    logoPreviewError = false;
                                }}
                            />
                        </label>
                        <label class="flex flex-col gap-1">
                            <span class="text-xs text-muted font-medium">
                                Logo-Breite
                            </span>
                            <input
                                class="input font-mono"
                                bind:value={profile.logo_width}
                                placeholder="3cm"
                            />
                        </label>
                    </div>
                    <div class="mt-3">
                        {#if logoPreviewUrl && !logoPreviewError}
                            <div
                                class="flex min-h-[96px] items-center justify-center rounded-2xl border border-dashed border-border bg-white/70 p-4"
                            >
                                <img
                                    src={logoPreviewUrl}
                                    alt="Logo-Vorschau"
                                    class="max-h-20 max-w-full object-contain"
                                    on:error={() => {
                                        logoPreviewError = true;
                                    }}
                                />
                            </div>
                        {:else}
                            <div
                                class="flex min-h-[96px] items-center justify-center rounded-2xl border border-dashed border-border bg-white/50 p-4 text-sm text-muted"
                            >
                                {#if profile.logo?.trim() && logoPreviewError}
                                    Logo konnte nicht geladen werden.
                                {:else}
                                    Noch keine Logo-Vorschau verfuegbar.
                                {/if}
                            </div>
                        {/if}
                    </div>
                </div>
                <label class="flex flex-col gap-1 col-span-2">
                    <span class="text-xs text-muted font-medium">Straße</span>
                    <input class="input" bind:value={profile.street} />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="text-xs text-muted font-medium">PLZ</span>
                    <input class="input" bind:value={profile.zip} />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="text-xs text-muted font-medium">Stadt</span>
                    <input class="input" bind:value={profile.city} />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="text-xs text-muted font-medium">Land</span>
                    <input class="input" bind:value={profile.country} />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="text-xs text-muted font-medium"
                        >Stundensatz (€)</span
                    >
                    <input
                        class="input"
                        type="number"
                        bind:value={profile.hourly_rate}
                    />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="text-xs text-muted font-medium"
                        >Steuernummer / USt-IdNr.</span
                    >
                    <input class="input" bind:value={profile.tax_id} />
                </label>
                <label class="flex flex-col gap-1 col-span-2">
                    <span class="text-xs text-muted font-medium">IBAN</span>
                    <input class="input font-mono" bind:value={profile.iban} />
                </label>
            </div>

            <div class="flex items-center gap-3">
                <button
                    class="primary-button"
                    disabled={saving}
                    on:click={saveProfile}
                >
                    {saving ? "Speichern…" : "Profil speichern"}
                </button>
                {#if saved}
                    <span class="text-xs text-green-500">Gespeichert ✓</span>
                {/if}
            </div>
        </section>

        <!-- Rechnungsgrunddaten section -->
        <section class="panel-section flex flex-col gap-4">
            <h2
                class="text-base font-semibold text-primary border-b border-border pb-2"
            >
                Rechnungsgrunddaten
            </h2>

            <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                    <span class="text-xs text-muted font-medium"
                        >Nummernkreis-Präfix</span
                    >
                    <input
                        class="input font-mono"
                        bind:value={profile.invoice_number_prefix}
                        placeholder="RE-2026-"
                    />
                    <span class="text-[11px] text-muted">
                        Naechste Nummer: {invoicePrefixPreview}
                    </span>
                    {#if invoicePrefixError}
                        <span class="text-[11px] text-red-500">
                            {invoicePrefixError}
                        </span>
                    {/if}
                </label>
                <label class="flex flex-col gap-1">
                    <span class="text-xs text-muted font-medium"
                        >Aktueller Zähler</span
                    >
                    <input
                        class="input font-mono"
                        type="number"
                        bind:value={profile.invoice_number_counter}
                        placeholder="1"
                    />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="text-xs text-muted font-medium"
                        >Zahlungsziel (Tage)</span
                    >
                    <input
                        class="input"
                        type="number"
                        bind:value={profile.payment_days}
                        placeholder="14"
                    />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="text-xs text-muted font-medium"
                        >Standard-MwSt. (%)</span
                    >
                    <input
                        class="input"
                        type="number"
                        bind:value={profile.default_vat_rate}
                        placeholder="19"
                    />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="text-xs text-muted font-medium">Bankname</span>
                    <input
                        class="input"
                        bind:value={profile.bank_name}
                        placeholder="Sparkasse Berlin"
                    />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="text-xs text-muted font-medium">BIC</span>
                    <input
                        class="input font-mono"
                        bind:value={profile.bic}
                        placeholder="BELADEBEXXX"
                    />
                </label>
                <label class="flex flex-col gap-1 col-span-2">
                    <span class="text-xs text-muted font-medium"
                        >Fußzeile / Dankestext</span
                    >
                    <input
                        class="input"
                        bind:value={profile.invoice_footer_text}
                        placeholder="Vielen Dank für Ihren Auftrag."
                    />
                </label>
            </div>

            <div class="flex items-center gap-3">
                <button
                    class="primary-button"
                    disabled={saving}
                    on:click={saveProfile}
                >
                    {saving ? "Speichern…" : "Speichern"}
                </button>
                {#if saved}
                    <span class="text-xs text-green-500">Gespeichert ✓</span>
                {/if}
            </div>
        </section>

        <section class="panel-section flex flex-col gap-4">
            <h2
                class="text-base font-semibold text-primary border-b border-border pb-2"
            >
                Angebotsgrunddaten
            </h2>

            <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                    <span class="text-xs text-muted font-medium">
                        Angebots-Präfix
                    </span>
                    <input
                        class="input font-mono"
                        bind:value={profile.offer_number_prefix}
                        placeholder="ANG-2026-"
                    />
                    <span class="text-[11px] text-muted">
                        Naechste Nummer: {offerPrefixPreview}
                    </span>
                    {#if offerPrefixError}
                        <span class="text-[11px] text-red-500">
                            {offerPrefixError}
                        </span>
                    {/if}
                </label>
                <label class="flex flex-col gap-1">
                    <span class="text-xs text-muted font-medium">
                        Angebots-Zähler
                    </span>
                    <input
                        class="input font-mono"
                        type="number"
                        bind:value={profile.offer_number_counter}
                        placeholder="1"
                    />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="text-xs text-muted font-medium">
                        Gueltigkeit (Tage)
                    </span>
                    <input
                        class="input"
                        type="number"
                        bind:value={profile.offer_validity_days}
                        placeholder="30"
                    />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="text-xs text-muted font-medium">
                        Zahlungsbedingungen
                    </span>
                    <input
                        class="input"
                        bind:value={profile.offer_payment_terms}
                        placeholder="30 Tage netto nach Auftragserteilung"
                    />
                </label>
                <label class="flex flex-col gap-1 col-span-2">
                    <span class="text-xs text-muted font-medium">
                        Lieferbedingungen
                    </span>
                    <input
                        class="input"
                        bind:value={profile.offer_delivery_terms}
                        placeholder="ca. 8-10 Wochen nach Projektstart"
                    />
                </label>
                <label class="flex flex-col gap-1 col-span-2">
                    <span class="text-xs text-muted font-medium">
                        Zusätzliche Bedingungen / AGB-Hinweise
                    </span>
                    <textarea
                        class="input resize-y min-h-[96px]"
                        bind:value={profile.offer_additional_terms}
                        placeholder="Jede Zeile wird als eigener Punkt auf der zweiten Seite ausgegeben."
                        rows={4}
                    />
                </label>
            </div>

            <div class="flex items-center gap-3">
                <button
                    class="primary-button"
                    disabled={saving}
                    on:click={saveProfile}
                >
                    {saving ? "Speichern…" : "Speichern"}
                </button>
                {#if saved}
                    <span class="text-xs text-green-500">Gespeichert ✓</span>
                {/if}
            </div>
        </section>

        <section class="panel-section flex flex-col gap-4">
            <h2 class="text-base font-semibold text-primary border-b border-border pb-2">
                Benachrichtigungen & Tagesrhythmus
            </h2>
            <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                    <span class="text-xs text-muted font-medium">Tagesabschluss-Uhrzeit</span>
                    <input
                        class="input"
                        type="time"
                        bind:value={profile.shutdown_time}
                        placeholder="17:00"
                    />
                    <span class="text-[11px] text-muted">Benachrichtigung zum Feierabend</span>
                </label>
                <label class="flex flex-col gap-1">
                    <span class="text-xs text-muted font-medium">Pausenerinnerung (Minuten)</span>
                    <input
                        class="input"
                        type="number"
                        min="0"
                        max="240"
                        bind:value={profile.break_interval_minutes}
                        placeholder="90"
                    />
                    <span class="text-[11px] text-muted">0 = deaktiviert</span>
                </label>
            </div>
            <div class="flex items-center gap-3">
                <button
                    class="primary-button"
                    disabled={saving}
                    on:click={saveProfile}
                >
                    {saving ? "Speichern…" : "Speichern"}
                </button>
                {#if saved}
                    <span class="text-xs text-green-500">Gespeichert ✓</span>
                {/if}
            </div>
        </section>

    {/if}

    {#if activeSection === "daten"}
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
    {/if}

    {#if activeSection === "arbeitsbereich"}
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
                            Pfad
                        </span>
                        <span class="text-primary break-all">
                            {activeTenant?.path ?? "Browser-Modus"}
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
                </div>
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

        <!-- Tenants section -->
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
                            >Speicherort</span
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
                                >{tenantDir || "Noch kein Ordner gewählt"}</span
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
    {/if}
</div>

<style>
    .section-tabs {
        display: inline-flex;
        gap: 6px;
        padding: 4px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.66);
        border: 1px solid var(--color-border);
        width: fit-content;
        box-shadow: 0 1px 0 rgba(255, 255, 255, 0.75) inset;
    }
    .section-tab {
        padding: 8px 12px;
        border-radius: 12px;
        color: var(--color-text-secondary);
        font-size: 13px;
        font-weight: 600;
        transition:
            background 0.15s,
            color 0.15s,
            box-shadow 0.15s;
    }
    .section-tab:hover {
        color: var(--color-text-primary);
        background: rgba(255, 255, 255, 0.7);
    }
    .section-tab-active {
        color: var(--color-text-primary);
        background: white;
        box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.8) inset,
            0 8px 18px rgba(15, 23, 42, 0.06);
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
