<!-- @core -->
<script lang="ts">
    import { convertFileSrc, invoke } from "@tauri-apps/api/core";
    import {
        $appConfig as appConfigStore,
        saveAppConfig,
    } from "../../stores/configStore";
    import { isTauriAvailable } from "../../lib/platform";
    import type { UserProfile } from "../../stores/configStore";
    import SettingsDatenSection from "./SettingsDatenSection.svelte";
    import SettingsArbeitsbereichSection from "./SettingsArbeitsbereichSection.svelte";

    let config = appConfigStore.get();
    let profile: UserProfile = { ...config.profile };
    let saved = false;
    let saving = false;
    let errorMsg = "";
    let logoImporting = false;
    let logoPreviewError = false;
    type SettingsSection = "profil" | "arbeitsbereich" | "daten";
    let activeSection: SettingsSection = "profil";

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

        {#if errorMsg}
            <p class="text-xs text-red-500">{errorMsg}</p>
        {/if}
    {/if}

    {#if activeSection === "daten"}
        <SettingsDatenSection />
    {/if}

    {#if activeSection === "arbeitsbereich"}
        <SettingsArbeitsbereichSection />
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
</style>
