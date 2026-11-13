<!-- @core -->
<script lang="ts">
    import { command } from "@casoon/origin-client";
    import {
        $appConfig as appConfigStore,
        saveAppConfig,
    } from "../../stores/configStore";
    import { isTauriAvailable } from "../../lib/platform";
    import type { UserProfile } from "../../stores/configStore";
    import {
        normalizeProfileNumbers,
        type ProfileNumberErrors,
    } from "../../lib/profileNumbers";
    import { onMount } from "svelte";
    import { KEYS, storageGet } from "../../lib/storage";
    import { snapshotLabel, type SnapshotMeta } from "../../lib/navigation";
    import { settingsEntries, type SettingsSectionId } from "../../lib/settingsStatus";
    import SettingsDatenSection from "./SettingsDatenSection.svelte";
    import SettingsArbeitsbereichSection from "./SettingsArbeitsbereichSection.svelte";

    let config = appConfigStore.get();
    let profile: UserProfile = { ...config.profile };
    let saved = false;
    let saving = false;
    let errorMsg = "";
    let numberErrors: ProfileNumberErrors = {};
    let logoImporting = false;
    let logoPreviewError = false;
    let activeSection: SettingsSectionId = "profil";
    let snapshot: string | null = null;

    let logoPreviewUrl = "";
    $: updateLogoPreview(profile.logo);
    // Der Rechnungszähler gehört zum Arbeitsbereich; hier nur das Format.
    $: invoicePrefixPreview = buildNumberPreview(
        profile.invoice_number_prefix,
        1,
        "RE-",
    );
    $: offerPrefixPreview = buildNumberPreview(
        profile.offer_number_prefix,
        1,
        "ANG-",
    );
    $: invoicePrefixError = validatePrefix(profile.invoice_number_prefix);
    $: offerPrefixError = validatePrefix(profile.offer_number_prefix);

    // Änderungen aus anderen Tabs (z. B. Arbeitsbereich) übernehmen, ohne ungespeicherte Profil-Eingaben zu verwerfen.
    appConfigStore.subscribe((c) => {
        if (!c) return;
        const previous = config.profile as unknown as Record<string, unknown>;
        const incoming = c.profile as unknown as Record<string, unknown>;
        const merged: Record<string, unknown> = {
            ...(profile as unknown as Record<string, unknown>),
        };
        for (const key of Object.keys(incoming)) {
            if (incoming[key] !== previous[key]) merged[key] = incoming[key];
        }
        config = c;
        profile = merged as unknown as UserProfile;
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
            const normalized = normalizeProfileNumbers(profile);
            numberErrors = normalized.errors;
            if (Object.keys(numberErrors).length > 0) {
                errorMsg = "Bitte korrigiere die markierten Felder.";
                return;
            }
            await saveAppConfig({ ...config, profile: normalized.profile });
            profile = { ...normalized.profile };
            saved = true;
            setTimeout(() => (saved = false), 2500);
        } catch (e) {
            errorMsg = `Speichern fehlgeschlagen: ${String(e)}`;
        } finally {
            saving = false;
        }
    }

    async function updateLogoPreview(path: string | undefined) {
        const value = path?.trim() ?? "";
        logoPreviewError = false;
        logoPreviewUrl = "";
        if (!value || !isTauriAvailable()) return;
        try {
            const url = await command<string>("logo_data_url", { path: value });
            if (profile.logo?.trim() === value) logoPreviewUrl = url;
        } catch {
            if (profile.logo?.trim() === value) logoPreviewError = true;
        }
    }

    async function importLogo() {
        if (!isTauriAvailable()) return;
        logoImporting = true;
        errorMsg = "";
        try {
            const imported = await command<string | null>("import_logo_file");
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
            return "Präfix sollte mindestens 2 Zeichen haben.";
        }
        if (!/^[A-Za-z0-9-_/]+$/.test(value)) {
            return "Präfix enthält ungültige Zeichen.";
        }
        return "";
    }

    function readSnapshot() {
        snapshot = snapshotLabel(storageGet<SnapshotMeta>(KEYS.exportMeta));
    }
    onMount(() => {
        readSnapshot();
        const id = setInterval(readSnapshot, 15 * 1000);
        return () => clearInterval(id);
    });

    $: desktop = isTauriAvailable();
    $: workspaceName = config.tenants?.find((t) => t.path === config.active_tenant)?.name ?? null;
    $: entries = settingsEntries({ profile, workspaceName: desktop ? workspaceName : null, snapshot, desktop });
</script>

<div class="flex-1 overflow-y-auto">
  <div class="flex flex-col gap-5 px-8 pt-5 pb-7">
    <header class="flex flex-col gap-0.5">
        <h1 class="text-[24px] font-bold tracking-[-0.01em] leading-tight">Einstellungen</h1>
        <span class="text-[13px]" style="color:var(--et-text-3)">
            {desktop ? `Arbeitsbereich „${workspaceName ?? "–"}“ · Desktop-App` : "Browser-Modus · Daten bleiben im Browser-Speicher"}
        </span>
    </header>

    <div class="flex flex-wrap gap-6 items-start">
        <nav class="flex-[1_1_200px] max-w-[240px] flex flex-col gap-0.5" aria-label="Einstellungsbereiche">
            {#each entries as entry (entry.id)}
                <button
                    class="settings-nav flex flex-col justify-center min-h-[52px] px-3 rounded-[9px] text-left"
                    class:settings-nav-active={activeSection === entry.id}
                    aria-current={activeSection === entry.id ? "page" : undefined}
                    on:click={() => (activeSection = entry.id)}
                >
                    <span class="{activeSection === entry.id ? 'font-semibold' : 'font-medium'}">{entry.label}</span>
                    <span class="text-[12px]" style="color:{entry.tone === 'warn' ? 'var(--et-warning-text)' : activeSection === entry.id ? 'var(--et-text-2)' : 'var(--et-text-3)'}">{entry.state}</span>
                </button>
            {/each}
        </nav>

        <div class="flex-[999_1_480px] min-w-0 max-w-[820px] flex flex-col gap-4">
    {#if activeSection === "profil"}
        <!-- Profile section -->
        <section class="et-card p-5 flex flex-col gap-4">
            <h2 class="et-h2">
                Profil
            </h2>

            <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                    <span class="et-label">Vorname</span>
                    <input class="et-field" bind:value={profile.first_name} placeholder="Max" />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="et-label">Nachname</span>
                    <input class="et-field" bind:value={profile.last_name} placeholder="Mustermann" />
                </label>
                <label class="flex flex-col gap-1 col-span-2">
                    <span class="et-label">E-Mail</span>
                    <input
                        class="et-field"
                        type="email"
                        bind:value={profile.email}
                        placeholder="max@beispiel.de"
                    />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="et-label">Telefon</span>
                    <input class="et-field" bind:value={profile.phone} />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="et-label">Webseite</span>
                    <input
                        class="et-field"
                        bind:value={profile.website}
                        placeholder="www.example.com"
                    />
                </label>
                <label class="flex flex-col gap-1 col-span-2">
                    <span class="et-label"
                        >Unternehmen</span
                    >
                    <input class="et-field" bind:value={profile.company} placeholder="Musterfirma GmbH" />
                </label>
                <div
                    class="col-span-2 rounded-[12px] border border-[var(--et-border)] bg-[var(--et-surface-sunken)] p-4"
                >
                    <div class="flex items-center justify-between gap-3">
                        <div class="min-w-0">
                            <p class="text-xs font-medium text-[var(--et-text-3)]">
                                Dokumenten-Logo
                            </p>
                            <p class="mt-1 text-sm text-[var(--et-text)] truncate">
                                {profile.logo || "Noch kein Logo hinterlegt"}
                            </p>
                        </div>
                        <button
                            class="et-btn"
                            on:click={importLogo}
                            disabled={!isTauriAvailable() || logoImporting}
                        >
                            {logoImporting ? "Import…" : "Logo wählen"}
                        </button>
                    </div>
                    <label class="mt-3 flex flex-col gap-1">
                        <span class="et-label">
                            Dateipfad
                        </span>
                        <input
                            class="et-field font-mono"
                            bind:value={profile.logo}
                            placeholder="/Users/.../company-logo.png"
                        />
                    </label>
                    <div class="mt-3">
                        {#if logoPreviewUrl && !logoPreviewError}
                            <div
                                class="flex min-h-[96px] items-center justify-center rounded-2xl border border-dashed border-border bg-[var(--et-surface-sunken)] p-4"
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
                                class="flex min-h-[96px] items-center justify-center rounded-2xl border border-dashed border-border bg-[var(--et-surface-sunken)] p-4 text-sm text-[var(--et-text-3)]"
                            >
                                {#if profile.logo?.trim() && logoPreviewError}
                                    Logo konnte nicht geladen werden.
                                {:else}
                                    Noch keine Logo-Vorschau verfügbar.
                                {/if}
                            </div>
                        {/if}
                    </div>
                </div>
                <label class="flex flex-col gap-1 col-span-2">
                    <span class="et-label">Straße</span>
                    <input class="et-field" bind:value={profile.street} placeholder="Musterstraße 1" />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="et-label">PLZ</span>
                    <input class="et-field" bind:value={profile.zip} placeholder="12345" />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="et-label">Stadt</span>
                    <input class="et-field" bind:value={profile.city} placeholder="Musterstadt" />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="et-label">Land</span>
                    <input class="et-field" bind:value={profile.country} />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="et-label"
                        >Stundensatz (€)</span
                    >
                    <input
                        class="et-field"
                        type="number"
                        bind:value={profile.hourly_rate}
                    />
                {#if numberErrors.hourly_rate}
                        <span class="text-[12px] text-[var(--et-danger)]">{numberErrors.hourly_rate}</span>
                    {/if}
                </label>
                <label class="flex flex-col gap-1">
                    <span class="et-label"
                        >Steuernummer / USt-IdNr. (Fußzeile: „USt-IdNr.“)</span
                    >
                    <input class="et-field" bind:value={profile.tax_id} placeholder="z. B. 12/345/67890 oder USt-IdNr." />
                </label>
                <label class="flex flex-col gap-1 col-span-2">
                    <span class="et-label">IBAN</span>
                    <input class="et-field font-mono" bind:value={profile.iban} placeholder="DE89 3704 0044 0532 0130 00" />
                </label>
            </div>

            <div class="flex items-center gap-3">
                <button
                    class="et-btn et-btn-primary"
                    disabled={saving}
                    on:click={saveProfile}
                >
                    {saving ? "Speichern…" : "Profil speichern"}
                </button>
                {#if saved}
                    <span class="text-[13px] text-[var(--et-success-text)]">Gespeichert</span>
                {/if}
                {#if errorMsg}
                    <span class="text-[13px] text-[var(--et-danger)]">{errorMsg}</span>
                {/if}
            </div>
        </section>

    {/if}

    {#if activeSection === "rechnungen"}
        <!-- Rechnungsgrunddaten section -->
        <section class="et-card p-5 flex flex-col gap-4">
            <h2 class="et-h2">
                Rechnungsgrunddaten
            </h2>

            <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                    <span class="et-label"
                        >Nummernkreis-Präfix</span
                    >
                    <input
                        class="et-field font-mono"
                        bind:value={profile.invoice_number_prefix}
                        placeholder="RE-2026-"
                    />
                    <span class="text-[12px] text-[var(--et-text-3)]">
                        Beispiel: {invoicePrefixPreview} · der Zähler läuft pro
                        Arbeitsbereich
                    </span>
                    {#if invoicePrefixError}
                        <span class="text-[12px] text-[var(--et-danger)]">
                            {invoicePrefixError}
                        </span>
                    {/if}
                </label>
                <label class="flex flex-col gap-1">
                    <span class="et-label"
                        >Zahlungsziel (Tage)</span
                    >
                    <input
                        class="et-field"
                        type="number"
                        min="0"
                        step="1"
                        bind:value={profile.payment_days}
                        placeholder="14"
                    />
                {#if numberErrors.payment_days}
                        <span class="text-[12px] text-[var(--et-danger)]">{numberErrors.payment_days}</span>
                    {/if}
                </label>
                <label class="flex flex-col gap-1">
                    <span class="et-label"
                        >Standard-MwSt. (%)</span
                    >
                    <input
                        class="et-field"
                        type="number"
                        bind:value={profile.default_vat_rate}
                        placeholder="19"
                    />
                {#if numberErrors.default_vat_rate}
                        <span class="text-[12px] text-[var(--et-danger)]">{numberErrors.default_vat_rate}</span>
                    {/if}
                </label>
                <label class="flex flex-col gap-1">
                    <span class="et-label">Bankname</span>
                    <input
                        class="et-field"
                        bind:value={profile.bank_name}
                        placeholder="Sparkasse Berlin"
                    />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="et-label">BIC</span>
                    <input
                        class="et-field font-mono"
                        bind:value={profile.bic}
                        placeholder="BELADEBEXXX"
                    />
                </label>
                <label class="flex flex-col gap-1 col-span-2">
                    <span class="et-label"
                        >Dankestext (unter der Anrede)</span
                    >
                    <input
                        class="et-field"
                        bind:value={profile.invoice_footer_text}
                        placeholder="Vielen Dank für Ihren Auftrag."
                    />
                </label>
            </div>

            <div class="flex items-center gap-3">
                <button
                    class="et-btn et-btn-primary"
                    disabled={saving}
                    on:click={saveProfile}
                >
                    {saving ? "Speichern…" : "Speichern"}
                </button>
                {#if saved}
                    <span class="text-[13px] text-[var(--et-success-text)]">Gespeichert</span>
                {/if}
                {#if errorMsg}
                    <span class="text-[13px] text-[var(--et-danger)]">{errorMsg}</span>
                {/if}
            </div>
        </section>

        <section class="et-card p-5 flex flex-col gap-4">
            <h2 class="et-h2">
                Angebotsgrunddaten
            </h2>

            <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                    <span class="et-label">
                        Angebots-Präfix
                    </span>
                    <input
                        class="et-field font-mono"
                        bind:value={profile.offer_number_prefix}
                        placeholder="ANG-2026-"
                    />
                    <span class="text-[12px] text-[var(--et-text-3)]">
                        Beispiel: {offerPrefixPreview} · der Zähler läuft pro
                        Arbeitsbereich
                    </span>
                    {#if offerPrefixError}
                        <span class="text-[12px] text-[var(--et-danger)]">
                            {offerPrefixError}
                        </span>
                    {/if}
                </label>
                <label class="flex flex-col gap-1">
                    <span class="et-label">
                        Gültigkeit (Tage)
                    </span>
                    <input
                        class="et-field"
                        type="number"
                        min="0"
                        step="1"
                        bind:value={profile.offer_validity_days}
                        placeholder="30"
                    />
                {#if numberErrors.offer_validity_days}
                        <span class="text-[12px] text-[var(--et-danger)]">{numberErrors.offer_validity_days}</span>
                    {/if}
                </label>
                <label class="flex flex-col gap-1">
                    <span class="et-label">
                        Zahlungsbedingungen
                    </span>
                    <input
                        class="et-field"
                        bind:value={profile.offer_payment_terms}
                        placeholder="30 Tage netto nach Auftragserteilung"
                    />
                </label>
                <label class="flex flex-col gap-1 col-span-2">
                    <span class="et-label">
                        Lieferbedingungen
                    </span>
                    <input
                        class="et-field"
                        bind:value={profile.offer_delivery_terms}
                        placeholder="ca. 8-10 Wochen nach Projektstart"
                    />
                </label>
                <label class="flex flex-col gap-1 col-span-2">
                    <span class="et-label">
                        Zusätzliche Bedingungen / AGB-Hinweise
                    </span>
                    <textarea
                        class="et-field resize-y min-h-[96px]"
                        bind:value={profile.offer_additional_terms}
                        placeholder="Jede Zeile wird als eigener Punkt auf der zweiten Seite ausgegeben."
                        rows={4}
                    />
                </label>
            </div>

            <div class="flex items-center gap-3">
                <button
                    class="et-btn et-btn-primary"
                    disabled={saving}
                    on:click={saveProfile}
                >
                    {saving ? "Speichern…" : "Speichern"}
                </button>
                {#if saved}
                    <span class="text-[13px] text-[var(--et-success-text)]">Gespeichert</span>
                {/if}
                {#if errorMsg}
                    <span class="text-[13px] text-[var(--et-danger)]">{errorMsg}</span>
                {/if}
            </div>
        </section>

    {/if}

    {#if activeSection === "tagesablauf"}
        <section class="et-card p-5 flex flex-col gap-4">
            <h2 class="et-h2">
                Benachrichtigungen & Tagesrhythmus
            </h2>
            <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                    <span class="et-label">Tagesabschluss-Uhrzeit</span>
                    <input
                        class="et-field"
                        type="time"
                        bind:value={profile.shutdown_time}
                        placeholder="17:00"
                    />
                    <span class="text-[12px] text-[var(--et-text-3)]">Benachrichtigung zum Feierabend</span>
                </label>
                <label class="flex flex-col gap-1">
                    <span class="et-label">Pausenerinnerung (Minuten)</span>
                    <input
                        class="et-field"
                        type="number"
                        min="0"
                        max="240"
                        step="1"
                        bind:value={profile.break_interval_minutes}
                        placeholder="90"
                    />
                    <span class="text-[12px] text-[var(--et-text-3)]">0 = deaktiviert</span>
                {#if numberErrors.break_interval_minutes}
                        <span class="text-[12px] text-[var(--et-danger)]">{numberErrors.break_interval_minutes}</span>
                    {/if}
                </label>
            </div>
            <div class="flex items-center gap-3">
                <button
                    class="et-btn et-btn-primary"
                    disabled={saving}
                    on:click={saveProfile}
                >
                    {saving ? "Speichern…" : "Speichern"}
                </button>
                {#if saved}
                    <span class="text-[13px] text-[var(--et-success-text)]">Gespeichert</span>
                {/if}
                {#if errorMsg}
                    <span class="text-[13px] text-[var(--et-danger)]">{errorMsg}</span>
                {/if}
            </div>
        </section>

    {/if}

    {#if activeSection === "daten"}
        <SettingsDatenSection />
    {/if}

    {#if activeSection === "arbeitsbereiche"}
        <SettingsArbeitsbereichSection />
    {/if}
        </div>
    </div>
  </div>
</div>

<style>
    .settings-nav {
        color: var(--et-text-2);
        transition: background-color 120ms;
    }
    .settings-nav:hover {
        background: var(--et-surface-sunken);
    }
    .settings-nav-active,
    .settings-nav-active:hover {
        background: var(--et-accent-soft);
        color: var(--et-accent-strong);
    }
</style>
