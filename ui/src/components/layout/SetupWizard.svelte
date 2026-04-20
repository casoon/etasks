<!-- @core -->
<script lang="ts">
    import { onMount } from "svelte";
    import { invoke } from "@tauri-apps/api/core";
    import {
        $appConfig as appConfigStore,
        saveAppConfig,
        writeTenantMeta,
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
            appPaths = await invoke<AppPaths>("app_paths").catch(() => ({}));
            existingWorkspaces = await invoke<string[]>("list_workspace_files").catch(() => []);
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
        if (!isTauriAvailable() || !tenantName.trim()) {
            pathPreview = null;
            return;
        }
        if (workspaceLocation === "custom" && customWorkspaceDir.trim()) {
            pathPreview = {
                workspaceDir: customWorkspaceDir,
                databasePath: `${customWorkspaceDir}/etasks.sqlite3`,
                assetsDir: `${customWorkspaceDir}/assets`,
            };
            return;
        }
        const baseDir = currentWorkspaceBaseDir();
        pathPreview = await invoke<WorkspacePaths>("default_workspace_paths", {
            tenantName: tenantName.trim(),
            baseDir,
        }).catch(() => null);
    }

    $: if (isTauriAvailable()) {
        void refreshPathPreview();
    }

    async function pickWorkspaceDirectory() {
        const picked = await invoke<string | null>("pick_directory", {
            defaultPath: customWorkspaceDir || appPaths.documentsDir || appPaths.appDataDir || null,
        }).catch(() => null);
        if (picked) {
            customWorkspaceDir = picked;
            workspaceLocation = "custom";
        }
    }

    async function pickExportDirectory() {
        const picked = await invoke<string | null>("pick_directory", {
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
            const path = workspaceLocation === "custom" && customWorkspaceDir.trim()
                ? `${customWorkspaceDir}/etasks.sqlite3`
                : await invoke<string>("default_tenant_path", {
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
    <div class="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col overflow-hidden">

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
                    <h2 class="text-xl font-semibold text-primary">Willkommen bei eTasks</h2>
                    <p class="text-sm text-secondary leading-relaxed">
                        Dein persönlicher Arbeitsorganisator für Projekte, Aufgaben, Zeiterfassung und Rechnungen – alles lokal auf deinem Gerät.
                    </p>
                </div>

                <div class="rounded-xl border border-border bg-bg/60 p-4 flex flex-col gap-3">
                    <div class="flex items-center gap-3 text-sm text-secondary">
                        <span class="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0"></span>
                        <span>Projekte &amp; Aufgaben verwalten</span>
                    </div>
                    <div class="flex items-center gap-3 text-sm text-secondary">
                        <span class="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0"></span>
                        <span>Zeiten erfassen &amp; auswerten</span>
                    </div>
                    <div class="flex items-center gap-3 text-sm text-secondary">
                        <span class="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0"></span>
                        <span>Rechnungen &amp; Angebote erstellen</span>
                    </div>
                    <div class="flex items-center gap-3 text-sm text-secondary">
                        <span class="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0"></span>
                        <span>Alle Daten bleiben lokal auf deinem Gerät</span>
                    </div>
                </div>

                <p class="text-xs text-muted">
                    In zwei kurzen Schritten richten wir deinen Arbeitsbereich ein.
                </p>

                {#if existingWorkspaces.length > 0}
                    <div class="rounded-xl border border-border bg-bg/60 p-4 flex flex-col gap-2">
                        <div class="text-xs font-medium text-secondary">Vorhandene Arbeitsbereiche</div>
                        {#each existingWorkspaces as wp}
                            {@const name = wp.split('/').pop()?.replace(/\.(etasks|sqlite3|sqlite|db)$/, '') ?? wp}
                            <button
                                class="text-left text-sm text-accent hover:underline truncate"
                                disabled={saving}
                                on:click={() => openExisting(wp)}
                            >{name}</button>
                        {/each}
                    </div>
                {/if}

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
                    <h2 class="text-xl font-semibold text-primary">Speicherorte festlegen</h2>
                    <p class="text-sm text-secondary">
                        eTasks legt pro Testnutzer einen eigenen Arbeitsbereichsordner an. Darin liegen die SQLite-Datenbank und spaeter auch Zusatzdateien wie Logos.
                    </p>
                </div>

                <div class="flex flex-col gap-3">
                    <label class="flex flex-col gap-1.5">
                        <span class="text-xs font-medium text-secondary">Name des Arbeitsbereichs</span>
                        <!-- svelte-ignore a11y-autofocus -->
                        <input
                            class="setup-input"
                            bind:value={tenantName}
                            placeholder="z. B. Studio Nord oder Max Mustermann"
                            autofocus
                            on:keydown={(e) => e.key === "Enter" && goNext()}
                        />
                    </label>

                    <div class="rounded-xl border border-border bg-bg/60 p-4 flex flex-col gap-3">
                        <div class="text-xs font-medium text-secondary">Arbeitsbereichsordner</div>
                        <label class="flex items-center gap-2 text-sm text-secondary">
                            <input type="radio" bind:group={workspaceLocation} value="documents" />
                            <span>Dokumente <span class="text-muted">(empfohlen fuer Testnutzer)</span></span>
                        </label>
                        {#if appPaths.documentsDir}
                            <p class="text-[11px] text-muted ml-6 break-all">{appPaths.documentsDir}</p>
                        {/if}
                        <label class="flex items-center gap-2 text-sm text-secondary">
                            <input type="radio" bind:group={workspaceLocation} value="appdata" />
                            <span>Versteckter App-Datenordner</span>
                        </label>
                        {#if appPaths.appDataDir}
                            <p class="text-[11px] text-muted ml-6 break-all">{appPaths.appDataDir}</p>
                        {/if}
                        <label class="flex items-center gap-2 text-sm text-secondary">
                            <input type="radio" bind:group={workspaceLocation} value="custom" />
                            <span>Eigener Projektordner</span>
                        </label>
                        <div class="ml-6 flex items-center gap-2">
                            <button class="btn-ghost text-[11px]" on:click={pickWorkspaceDirectory} disabled={!isTauriAvailable()}>
                                Ordner wählen
                            </button>
                            <span class="text-[11px] text-muted truncate">{customWorkspaceDir || "Noch kein Ordner gewählt"}</span>
                        </div>
                    </div>

                    <div class="rounded-xl border border-border bg-bg/60 p-4 flex flex-col gap-3">
                        <div class="text-xs font-medium text-secondary">Standardordner fuer Exporte und PDFs</div>
                        <label class="flex items-center gap-2 text-sm text-secondary">
                            <input type="radio" bind:group={exportLocation} value="downloads" />
                            <span>Downloads</span>
                        </label>
                        {#if appPaths.downloadsDir}
                            <p class="text-[11px] text-muted ml-6 break-all">{appPaths.downloadsDir}</p>
                        {/if}
                        <label class="flex items-center gap-2 text-sm text-secondary">
                            <input type="radio" bind:group={exportLocation} value="documents" />
                            <span>Dokumente</span>
                        </label>
                        {#if appPaths.documentsDir}
                            <p class="text-[11px] text-muted ml-6 break-all">{appPaths.documentsDir}</p>
                        {/if}
                        <label class="flex items-center gap-2 text-sm text-secondary">
                            <input type="radio" bind:group={exportLocation} value="custom" />
                            <span>Eigener Ordner</span>
                        </label>
                        <div class="ml-6 flex items-center gap-2">
                            <button class="btn-ghost text-[11px]" on:click={pickExportDirectory} disabled={!isTauriAvailable()}>
                                Ordner wählen
                            </button>
                            <span class="text-[11px] text-muted truncate">{customExportDir || "Noch kein Ordner gewählt"}</span>
                        </div>
                    </div>

                    {#if pathPreview}
                        <div class="rounded-lg bg-accent/5 border border-accent/20 px-3 py-2.5 text-xs text-secondary flex flex-col gap-1.5">
                            <div><span class="font-medium text-accent">Ordner:</span> <span class="font-mono break-all">{pathPreview.workspaceDir}</span></div>
                            <div><span class="font-medium text-accent">Datenbank:</span> <span class="font-mono break-all">{pathPreview.databasePath}</span></div>
                            <div><span class="font-medium text-accent">Assets:</span> <span class="font-mono break-all">{pathPreview.assetsDir}</span></div>
                        </div>
                    {/if}

                    {#if errorMsg}
                        <p class="text-xs text-red-500">{errorMsg}</p>
                    {/if}
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
