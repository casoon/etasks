<!-- @core -->
<script lang="ts">
    import { onMount } from "svelte";
    import { command } from "@casoon/origin-client";
    import {
        $appConfig as appConfigStore,
        saveAppConfig,
        writeTenantMeta,
        tenantNameFromPath,
    } from "../../stores/configStore";
    import { activateTenant } from "../../lib/appBootstrap";
    import { isTauriAvailable } from "../../lib/platform";
    import type { AppConfig } from "../../stores/configStore";

    export let onDone: () => void = () => {};

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

    let existingWorkspaces: string[] = [];
    let appPaths: AppPaths = {};
    let pathPreview: WorkspacePaths | null = null;
    // Datenbank eines Arbeitsbereichs, der direkt im gewählten eigenen Ordner liegt.
    let existingInCustomDir: string | null = null;
    let customWorkspaceDir = "";
    let customExportDir = "";
    let workspaceLocation: "documents" | "appdata" | "custom" = "documents";
    let exportLocation: "downloads" | "documents" | "custom" = "downloads";
    let config: AppConfig = appConfigStore.get();

    appConfigStore.subscribe((value) => {
        config = value;
    });

    onMount(async () => {
        if (isTauriAvailable()) {
            appPaths = await command<AppPaths>("app_paths").catch(() => ({}));
            existingWorkspaces = await command<string[]>("list_workspace_files").catch(() => []);
            hydrateLocationDefaults();
            await refreshPathPreview();
        }
    });

    async function openExisting(path: string) {
        saving = true;
        errorMsg = "";
        try {
            await activateTenant(path);
            const { saveAppConfig: sac } = await import("../../stores/configStore");
            const cfg = (await import("../../stores/configStore")).$appConfig.get();
            await sac({ ...cfg, setup_done: true });
            onDone();
        } catch (e) {
            errorMsg = String(e);
            saving = false;
        }
    }

    // Steps: 1 = welcome, 2 = workspace, 3 = profile
    let step = 1;
    let tenantName = "";
    let firstName = "";
    let lastName = "";
    let email = "";
    let company = "";
    let saving = false;
    let errorMsg = "";

    function hydrateLocationDefaults() {
        const workspaceDefault = config.default_workspace_dir?.trim() ?? "";
        if (workspaceDefault) {
            if (workspaceDefault === appPaths.documentsDir) {
                workspaceLocation = "documents";
            } else if (workspaceDefault === appPaths.appDataDir) {
                workspaceLocation = "appdata";
            } else {
                workspaceLocation = "custom";
                customWorkspaceDir = workspaceDefault;
            }
        }

        const exportDefault = config.default_export_dir?.trim() ?? "";
        if (exportDefault) {
            if (exportDefault === appPaths.downloadsDir) {
                exportLocation = "downloads";
            } else if (exportDefault === appPaths.documentsDir) {
                exportLocation = "documents";
            } else {
                exportLocation = "custom";
                customExportDir = exportDefault;
            }
        }
    }

    function goNext() {
        errorMsg = "";
        if (step === 2 && !tenantName.trim()) {
            errorMsg = "Bitte gib einen Namen für deinen Arbeitsbereich ein.";
            return;
        }
        if (step === 2 && workspaceLocation === "custom" && !customWorkspaceDir.trim()) {
            errorMsg = "Bitte wähle einen Projektordner für den Arbeitsbereich.";
            return;
        }
        if (step === 2 && exportLocation === "custom" && !customExportDir.trim()) {
            errorMsg = "Bitte wähle einen Standardordner für Exporte.";
            return;
        }
        step += 1;
    }

    function tenantSlug(name: string): string {
        return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'mandant';
    }

    function currentWorkspaceBaseDir(): string | null {
        if (workspaceLocation === "custom") return customWorkspaceDir || null;
        if (workspaceLocation === "appdata") return appPaths.appDataDir ?? null;
        return appPaths.documentsDir ?? null;
    }

    function currentExportDir(): string | null {
        if (exportLocation === "custom") return customExportDir || null;
        if (exportLocation === "documents") return appPaths.documentsDir ?? null;
        return appPaths.downloadsDir ?? null;
    }

    async function refreshPathPreview() {
        existingInCustomDir = null;
        if (!isTauriAvailable() || !tenantName.trim()) {
            pathPreview = null;
            return;
        }
        if (workspaceLocation === "custom" && customWorkspaceDir.trim()) {
            const direct = await command<WorkspacePaths>("workspace_paths", {
                path: customWorkspaceDir.trim(),
            }).catch(() => null);
            if (direct && (await command<boolean>("file_exists", { path: direct.databasePath }).catch(() => false))) {
                existingInCustomDir = direct.databasePath;
            }
        }
        const baseDir = currentWorkspaceBaseDir();
        pathPreview = await command<WorkspacePaths>("default_workspace_paths", {
            tenantName: tenantName.trim(),
            baseDir,
        }).catch(() => null);
    }

    $: tenantName, workspaceLocation, customWorkspaceDir, appPaths, void refreshPathPreview();

    async function pickWorkspaceDirectory() {
        const picked = await command<string | null>("pick_directory", {
            defaultPath: customWorkspaceDir || appPaths.documentsDir || appPaths.appDataDir || null,
        }).catch(() => null);
        if (picked) {
            customWorkspaceDir = picked;
            workspaceLocation = "custom";
        }
    }

    async function pickExportDirectory() {
        const picked = await command<string | null>("pick_directory", {
            defaultPath: currentExportDir() || appPaths.downloadsDir || appPaths.documentsDir || null,
        }).catch(() => null);
        if (picked) {
            customExportDir = picked;
            exportLocation = "custom";
        }
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
            const path = await command<string>("default_tenant_path", {
                tenantName: displayName,
                baseDir: currentWorkspaceBaseDir(),
            });
            const updated: AppConfig = {
                ...config,
                setup_done: true,
                default_workspace_dir: currentWorkspaceBaseDir(),
                default_export_dir: currentExportDir(),
                profile: {
                    ...config.profile,
                    first_name: firstName.trim() || config.profile.first_name,
                    last_name: lastName.trim() || config.profile.last_name,
                    email: email.trim() || config.profile.email,
                    company: company.trim() || config.profile.company,
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

<div class="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(28,27,25,0.55)]">
    <div class="bg-[var(--et-surface)] border border-[var(--et-border)] rounded-[14px] shadow-[var(--et-shadow-overlay)] w-full max-w-2xl mx-4 flex flex-col overflow-hidden">

        <!-- Progress bar -->
        <div class="h-1 bg-[var(--et-track)]">
            <div
                class="h-full bg-[var(--et-accent)] transition-all duration-300"
                style="width: {(step / 3) * 100}%"
            ></div>
        </div>

        <div class="p-8 flex flex-col gap-6">

            <!-- Step 1: Welcome -->
            {#if step === 1}
                <div class="flex flex-col gap-2">
                    <h2 class="text-xl font-semibold text-[var(--et-text)]">Willkommen bei eTasks</h2>
                    <p class="text-sm text-[var(--et-text-2)] leading-relaxed">
                        Dein persönlicher Arbeitsorganisator für Projekte, Aufgaben, Zeiterfassung und Rechnungen – alles lokal auf deinem Gerät.
                    </p>
                </div>

                <div class="rounded-[12px] border border-[var(--et-border)] bg-[var(--et-surface-sunken)] p-4 flex flex-col gap-3">
                    <div class="flex items-center gap-3 text-sm text-[var(--et-text-2)]">
                        <span class="w-1.5 h-1.5 rounded-full bg-[var(--et-accent)] flex-shrink-0"></span>
                        <span>Projekte &amp; Aufgaben verwalten</span>
                    </div>
                    <div class="flex items-center gap-3 text-sm text-[var(--et-text-2)]">
                        <span class="w-1.5 h-1.5 rounded-full bg-[var(--et-accent)] flex-shrink-0"></span>
                        <span>Zeiten erfassen &amp; auswerten</span>
                    </div>
                    <div class="flex items-center gap-3 text-sm text-[var(--et-text-2)]">
                        <span class="w-1.5 h-1.5 rounded-full bg-[var(--et-accent)] flex-shrink-0"></span>
                        <span>Rechnungen &amp; Angebote erstellen</span>
                    </div>
                    <div class="flex items-center gap-3 text-sm text-[var(--et-text-2)]">
                        <span class="w-1.5 h-1.5 rounded-full bg-[var(--et-accent)] flex-shrink-0"></span>
                        <span>Alle Daten bleiben lokal auf deinem Gerät</span>
                    </div>
                </div>

                <p class="text-xs text-[var(--et-text-3)]">
                    In zwei kurzen Schritten richten wir deinen Arbeitsbereich ein.
                </p>

                {#if existingWorkspaces.length > 0}
                    <div class="rounded-[12px] border border-[var(--et-border)] bg-[var(--et-surface-sunken)] p-4 flex flex-col gap-2">
                        <div class="et-label">Vorhandene Arbeitsbereiche</div>
                        {#each existingWorkspaces as wp}
                            {@const name = tenantNameFromPath(wp)}
                            <button
                                class="text-left text-sm font-semibold text-[var(--et-accent-strong)] hover:underline truncate min-h-[44px]"
                                disabled={saving}
                                on:click={() => openExisting(wp)}
                            >{name}</button>
                        {/each}
                    </div>
                {/if}

                <div class="flex justify-end">
                    <button class="et-btn et-btn-primary" on:click={goNext}>
                        Los geht's
                    </button>
                </div>
            {/if}

            <!-- Step 2: Workspace -->
            {#if step === 2}
                <div class="flex flex-col gap-2">
                    <div class="text-xs font-medium text-[var(--et-text-3)] uppercase tracking-wide">Schritt 1 von 2</div>
                    <h2 class="text-xl font-semibold text-[var(--et-text)]">Speicherorte festlegen</h2>
                    <p class="text-sm text-[var(--et-text-2)]">
                        eTasks legt pro Testnutzer einen eigenen Arbeitsbereichsordner an. Darin liegen die SQLite-Datenbank und später auch Zusatzdateien wie Logos.
                    </p>
                </div>

                <div class="flex flex-col gap-3">
                    <label class="flex flex-col gap-1.5">
                        <span class="et-label">Name des Arbeitsbereichs</span>
                        <!-- svelte-ignore a11y-autofocus -->
                        <input
                            class="et-field"
                            bind:value={tenantName}
                            placeholder="z. B. Studio Nord oder Max Mustermann"
                            autofocus
                            on:keydown={(e) => e.key === "Enter" && goNext()}
                        />
                    </label>

                    <div class="rounded-[12px] border border-[var(--et-border)] bg-[var(--et-surface-sunken)] p-4 flex flex-col gap-3">
                        <div class="et-label">Arbeitsbereichsordner</div>
                        <label class="flex items-center gap-2 min-h-[44px] text-sm text-[var(--et-text-2)]">
                            <input type="radio" bind:group={workspaceLocation} value="documents" />
                            <span>Dokumente <span class="text-[var(--et-text-3)]">(empfohlen für Testnutzer)</span></span>
                        </label>
                        {#if appPaths.documentsDir}
                            <p class="text-[12px] text-[var(--et-text-3)] ml-6 break-all">{appPaths.documentsDir}</p>
                        {/if}
                        <label class="flex items-center gap-2 min-h-[44px] text-sm text-[var(--et-text-2)]">
                            <input type="radio" bind:group={workspaceLocation} value="appdata" />
                            <span>Versteckter App-Datenordner</span>
                        </label>
                        {#if appPaths.appDataDir}
                            <p class="text-[12px] text-[var(--et-text-3)] ml-6 break-all">{appPaths.appDataDir}</p>
                        {/if}
                        <label class="flex items-center gap-2 min-h-[44px] text-sm text-[var(--et-text-2)]">
                            <input type="radio" bind:group={workspaceLocation} value="custom" />
                            <span>Eigener Projektordner</span>
                        </label>
                        <div class="ml-6 flex items-center gap-2">
                            <button class="et-btn et-btn-sm" on:click={pickWorkspaceDirectory} disabled={!isTauriAvailable()}>
                                Ordner wählen
                            </button>
                            <span class="text-[12px] text-[var(--et-text-3)] truncate">{customWorkspaceDir || "Noch kein Ordner gewählt"}</span>
                        </div>
                    </div>

                    <div class="rounded-[12px] border border-[var(--et-border)] bg-[var(--et-surface-sunken)] p-4 flex flex-col gap-3">
                        <div class="et-label">Standardordner für Exporte und PDFs</div>
                        <label class="flex items-center gap-2 min-h-[44px] text-sm text-[var(--et-text-2)]">
                            <input type="radio" bind:group={exportLocation} value="downloads" />
                            <span>Downloads</span>
                        </label>
                        {#if appPaths.downloadsDir}
                            <p class="text-[12px] text-[var(--et-text-3)] ml-6 break-all">{appPaths.downloadsDir}</p>
                        {/if}
                        <label class="flex items-center gap-2 min-h-[44px] text-sm text-[var(--et-text-2)]">
                            <input type="radio" bind:group={exportLocation} value="documents" />
                            <span>Dokumente</span>
                        </label>
                        {#if appPaths.documentsDir}
                            <p class="text-[12px] text-[var(--et-text-3)] ml-6 break-all">{appPaths.documentsDir}</p>
                        {/if}
                        <label class="flex items-center gap-2 min-h-[44px] text-sm text-[var(--et-text-2)]">
                            <input type="radio" bind:group={exportLocation} value="custom" />
                            <span>Eigener Ordner</span>
                        </label>
                        <div class="ml-6 flex items-center gap-2">
                            <button class="et-btn et-btn-sm" on:click={pickExportDirectory} disabled={!isTauriAvailable()}>
                                Ordner wählen
                            </button>
                            <span class="text-[12px] text-[var(--et-text-3)] truncate">{customExportDir || "Noch kein Ordner gewählt"}</span>
                        </div>
                    </div>

                    {#if existingInCustomDir}
                        <div class="rounded-[12px] border border-[var(--et-border)] bg-[var(--et-surface-sunken)] p-3 text-xs text-[var(--et-text-2)] flex flex-col gap-2">
                            <span>In diesem Ordner liegt bereits ein Arbeitsbereich. Ein neuer Arbeitsbereich wird in einem eigenen Unterordner angelegt; der vorhandene bleibt unverändert.</span>
                            <button
                                class="et-btn et-btn-sm self-start"
                                disabled={saving}
                                on:click={() => existingInCustomDir && openExisting(existingInCustomDir)}
                            >Vorhandenen Arbeitsbereich öffnen</button>
                        </div>
                    {/if}
                    {#if pathPreview}
                        <div class="rounded-[9px] bg-[var(--et-accent-soft)] border border-[var(--et-accent)] px-3 py-2.5 text-xs text-[var(--et-text-2)] flex flex-col gap-1.5">
                            <div><span class="font-semibold text-[var(--et-accent-strong)]">Ordner:</span> <span class="font-mono break-all">{pathPreview.workspaceDir}</span></div>
                            <div><span class="font-semibold text-[var(--et-accent-strong)]">Datenbank:</span> <span class="font-mono break-all">{pathPreview.databasePath}</span></div>
                            <div><span class="font-semibold text-[var(--et-accent-strong)]">Assets:</span> <span class="font-mono break-all">{pathPreview.assetsDir}</span></div>
                        </div>
                    {/if}

                    {#if errorMsg}
                        <p class="text-[13px] text-[var(--et-danger)]">{errorMsg}</p>
                    {/if}
                </div>

                <div class="flex justify-between">
                    <button class="et-btn et-btn-ghost" on:click={() => step = 1}>Zurück</button>
                    <button
                        class="et-btn et-btn-primary"
                        disabled={!tenantName.trim()}
                        on:click={goNext}
                    >
                        Weiter
                    </button>
                </div>
            {/if}

            <!-- Step 3: Profile -->
            {#if step === 3}
                <div class="flex flex-col gap-2">
                    <div class="text-xs font-medium text-[var(--et-text-3)] uppercase tracking-wide">Schritt 2 von 2</div>
                    <h2 class="text-xl font-semibold text-[var(--et-text)]">Dein Profil</h2>
                    <p class="text-sm text-[var(--et-text-2)]">
                        Diese Angaben erscheinen auf Rechnungen. Straße, Ort, Steuernummer und IBAN ergänzt du in den Einstellungen → Profil, bevor du das erste PDF erzeugst.
                    </p>
                </div>

                <div class="flex flex-col gap-3">
                    <div class="grid grid-cols-2 gap-3">
                        <label class="flex flex-col gap-1.5">
                            <span class="et-label">Vorname</span>
                            <input class="et-field" bind:value={firstName} placeholder="Max" />
                        </label>
                        <label class="flex flex-col gap-1.5">
                            <span class="et-label">Nachname</span>
                            <input class="et-field" bind:value={lastName} placeholder="Mustermann" />
                        </label>
                    </div>
                    <label class="flex flex-col gap-1.5">
                        <span class="et-label">E-Mail</span>
                        <input class="et-field" type="email" bind:value={email} placeholder="max@beispiel.de" />
                    </label>
                    <label class="flex flex-col gap-1.5">
                        <span class="et-label">Unternehmen <span class="text-[var(--et-text-3)] font-normal">(optional)</span></span>
                        <input class="et-field" bind:value={company} placeholder="Mein Unternehmen GmbH" />
                    </label>

                    {#if errorMsg}
                        <p class="text-[13px] text-[var(--et-danger)]">{errorMsg}</p>
                    {/if}
                </div>

                <div class="flex justify-between">
                    <button class="et-btn et-btn-ghost" on:click={() => step = 2}>Zurück</button>
                    <button
                        class="et-btn et-btn-primary"
                        disabled={saving}
                        on:click={finish}
                    >
                        {saving ? "Wird eingerichtet…" : "eTasks starten"}
                    </button>
                </div>
            {/if}

        </div>
    </div>
</div>
