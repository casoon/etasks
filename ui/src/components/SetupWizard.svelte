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

    // Steps: 1 = welcome, 2 = workspace, 3 = profile
    let step = 1;
    let tenantName = "";
    let firstName = "";
    let lastName = "";
    let email = "";
    let company = "";
    let saving = false;
    let errorMsg = "";
    let customPath: string | null = null; // null = default path

    const config = appConfigStore.get();

    function goNext() {
        errorMsg = "";
        if (step === 2 && !tenantName.trim()) {
            errorMsg = "Bitte gib einen Namen für deinen Arbeitsbereich ein.";
            return;
        }
        step += 1;
    }

    async function pickCustomPath() {
        const displayName = tenantName.trim() || "Mein Arbeitsbereich";
        const picked = await invoke<string | null>("pick_tenant_path", { tenantName: displayName });
        if (picked) customPath = picked;
    }

    async function finish() {
        errorMsg = "";
        saving = true;
        try {
            if (!isTauriAvailable()) {
                errorMsg =
                    "Das initiale Setup ist nur in der Desktop-App verfügbar.";
                saving = false;
                return;
            }
            const displayName = tenantName.trim() || "Mein Arbeitsbereich";
            const path = customPath ?? await invoke<string>("default_tenant_path", {
                tenantName: displayName,
            });
            const updated: AppConfig = {
                ...config,
                setup_done: true,
                profile: {
                    ...config.profile,
                    first_name: firstName.trim() || config.profile.first_name,
                    last_name: lastName.trim() || config.profile.last_name,
                    email: email.trim() || config.profile.email,
                    company:
                        company.trim() ||
                        (config.profile.company === "Musterfirma GmbH"
                            ? displayName
                            : config.profile.company),
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

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
    <div class="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col overflow-hidden">

        <!-- Progress bar -->
        <div class="h-1 bg-border">
            <div
                class="h-full bg-accent transition-all duration-300"
                style="width: {(step / 3) * 100}%"
            ></div>
        </div>

        <div class="p-8 flex flex-col gap-6">

            <!-- Step 1: Welcome -->
            {#if step === 1}
                <div class="flex flex-col gap-2">
                    <div class="text-3xl mb-1">👋</div>
                    <h2 class="text-xl font-semibold text-primary">Willkommen bei eTasks</h2>
                    <p class="text-sm text-secondary leading-relaxed">
                        eTasks ist dein persönlicher Arbeitsorganisator für Projekte, Aufgaben, Zeiterfassung und Rechnungen – alles lokal auf deinem Gerät.
                    </p>
                </div>

                <div class="rounded-xl border border-border bg-bg/60 p-4 flex flex-col gap-2.5">
                    <div class="flex items-start gap-3 text-sm text-secondary">
                        <span class="text-accent mt-0.5">▦</span>
                        <span>Projekte & Aufgaben verwalten</span>
                    </div>
                    <div class="flex items-start gap-3 text-sm text-secondary">
                        <span class="text-accent mt-0.5">⏲</span>
                        <span>Zeiten erfassen & auswerten</span>
                    </div>
                    <div class="flex items-start gap-3 text-sm text-secondary">
                        <span class="text-accent mt-0.5">€</span>
                        <span>Rechnungen & Angebote erstellen</span>
                    </div>
                    <div class="flex items-start gap-3 text-sm text-secondary">
                        <span class="text-accent mt-0.5">🔒</span>
                        <span>Alle Daten bleiben lokal auf deinem Gerät</span>
                    </div>
                </div>

                <p class="text-xs text-muted">
                    In zwei kurzen Schritten richten wir deinen Arbeitsbereich ein.
                </p>

                <div class="flex justify-end">
                    <button class="btn-primary" on:click={goNext}>
                        Los geht's →
                    </button>
                </div>
            {/if}

            <!-- Step 2: Workspace -->
            {#if step === 2}
                <div class="flex flex-col gap-2">
                    <div class="text-xs font-medium text-muted uppercase tracking-wide">Schritt 1 von 2</div>
                    <h2 class="text-xl font-semibold text-primary">Arbeitsbereich einrichten</h2>
                    <p class="text-sm text-secondary">
                        Gib deinem Arbeitsbereich einen Namen. Das ist in der Regel dein Name oder dein Unternehmensname.
                    </p>
                </div>

                <div class="flex flex-col gap-3">
                    <label class="flex flex-col gap-1.5">
                        <span class="text-xs font-medium text-secondary">Name des Arbeitsbereichs</span>
                        <input
                            class="setup-input"
                            bind:value={tenantName}
                            placeholder="z. B. Studio Nord oder Max Mustermann"
                            autofocus
                            on:keydown={(e) => e.key === "Enter" && goNext()}
                        />
                    </label>

                    {#if errorMsg}
                        <p class="text-xs text-red-500">{errorMsg}</p>
                    {/if}

                    <div class="rounded-lg bg-accent/5 border border-accent/20 px-3 py-2.5 text-xs text-secondary flex flex-col gap-2">
                        <div class="flex items-center justify-between gap-2">
                            <span>
                                <span class="font-medium text-accent">Speicherort:</span>
                                {#if customPath}
                                    <span class="font-mono break-all">{customPath}</span>
                                {:else}
                                    Standard-App-Datenordner
                                {/if}
                            </span>
                            {#if isTauriAvailable()}
                                <button
                                    class="btn-ghost text-[11px] whitespace-nowrap flex-shrink-0"
                                    on:click={pickCustomPath}
                                    disabled={!tenantName.trim()}
                                >Anderen wählen</button>
                            {/if}
                        </div>
                        {#if customPath}
                            <button class="text-[11px] text-muted hover:text-secondary text-left" on:click={() => customPath = null}>
                                ↺ Standard verwenden
                            </button>
                        {/if}
                    </div>
                </div>

                <div class="flex justify-between">
                    <button class="btn-ghost" on:click={() => step = 1}>← Zurück</button>
                    <button
                        class="btn-primary"
                        disabled={!tenantName.trim()}
                        on:click={goNext}
                    >
                        Weiter →
                    </button>
                </div>
            {/if}

            <!-- Step 3: Profile -->
            {#if step === 3}
                <div class="flex flex-col gap-2">
                    <div class="text-xs font-medium text-muted uppercase tracking-wide">Schritt 2 von 2</div>
                    <h2 class="text-xl font-semibold text-primary">Dein Profil</h2>
                    <p class="text-sm text-secondary">
                        Diese Angaben erscheinen auf Rechnungen. Du kannst sie jederzeit in den Einstellungen ändern.
                    </p>
                </div>

                <div class="flex flex-col gap-3">
                    <div class="grid grid-cols-2 gap-3">
                        <label class="flex flex-col gap-1.5">
                            <span class="text-xs font-medium text-secondary">Vorname</span>
                            <input class="setup-input" bind:value={firstName} placeholder="Max" />
                        </label>
                        <label class="flex flex-col gap-1.5">
                            <span class="text-xs font-medium text-secondary">Nachname</span>
                            <input class="setup-input" bind:value={lastName} placeholder="Mustermann" />
                        </label>
                    </div>
                    <label class="flex flex-col gap-1.5">
                        <span class="text-xs font-medium text-secondary">E-Mail</span>
                        <input class="setup-input" type="email" bind:value={email} placeholder="max@beispiel.de" />
                    </label>
                    <label class="flex flex-col gap-1.5">
                        <span class="text-xs font-medium text-secondary">Unternehmen <span class="text-muted font-normal">(optional)</span></span>
                        <input class="setup-input" bind:value={company} placeholder="Mein Unternehmen GmbH" />
                    </label>

                    {#if errorMsg}
                        <p class="text-xs text-red-500">{errorMsg}</p>
                    {/if}
                </div>

                <div class="flex justify-between">
                    <button class="btn-ghost" on:click={() => step = 2}>← Zurück</button>
                    <button
                        class="btn-primary"
                        disabled={saving}
                        on:click={finish}
                    >
                        {saving ? "Wird eingerichtet…" : "eTasks starten →"}
                    </button>
                </div>
            {/if}

        </div>
    </div>
</div>

<style>
    .setup-input {
        width: 100%;
        padding: 8px 12px;
        background: var(--color-bg);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        color: var(--color-text-primary);
        font-size: 13px;
        outline: none;
        transition: border-color 0.15s;
    }
    .setup-input:focus {
        border-color: var(--color-accent);
    }
    .btn-primary {
        padding: 8px 18px;
        background: var(--color-accent);
        color: white;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: opacity 0.15s;
    }
    .btn-primary:hover:not(:disabled) {
        opacity: 0.88;
    }
    .btn-primary:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
    .btn-ghost {
        padding: 8px 14px;
        color: var(--color-text-secondary);
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s;
    }
    .btn-ghost:hover {
        background: var(--color-bg);
    }
</style>
