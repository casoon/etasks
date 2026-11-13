<!-- @core -->
<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import {
        $navItem as navItemStore,
        $quickAddOpen as quickAddOpenStore,
    } from "../../stores/uiStore";
    import { $selectedProjectId as selectedProjectIdStore } from "../../stores/projectStore";
    import { reinitStores } from "../../lib/storeInit";
    import { scheduleDailySnapshot } from "../../lib/exportService";
    import {
        loadAppConfig,
        $configStatus as configStatusStore,
        resetCorruptConfig,
        type TenantInfo,
    } from "../../stores/configStore";
    import { toast } from "../../stores/toastStore";
    import { activateTenant } from "../../lib/appBootstrap";
    import { isTauriAvailable } from "../../lib/platform";
    import { command } from "@casoon/origin-client";
    import { startNotificationScheduler, stopNotificationScheduler } from "../../lib/notificationScheduler";
    import { startPomodoroTicker, stopPomodoroTicker } from "../../lib/pomodoroTimer";
    import { logger } from "../../lib/logger";
    import TodayShell from "../views/TodayShell.svelte";
    import OverviewView from "../views/OverviewView.svelte";
    import ClientManager from "../modals/ClientManager.svelte";
    import ServiceCatalog from "../modals/ServiceCatalog.svelte";
    import WeekView from "../views/WeekView.svelte";
    import StaleTimerDialog from "../modals/StaleTimerDialog.svelte";
    import ProjectsView from "../views/ProjectsView.svelte";
    import TimeTrackingView from "../views/TimeTrackingView.svelte";
    import ClientsView from "../views/ClientsView.svelte";
    import QuickAddModal from "../modals/QuickAddModal.svelte";
    import SetupWizard from "./SetupWizard.svelte";
    import StartupProblem from "./StartupProblem.svelte";
    import SettingsView from "../views/SettingsView.svelte";
    import ReportView from "../views/ReportView.svelte";
    import ToastContainer from "../shared/ToastContainer.svelte";
    import EnergyCheck from "../modals/EnergyCheck.svelte";
    import { pageReveal } from "../../lib/motionActions";

    let nav: string = navItemStore.get();

    // Default: show setup overlay until we verify the app state
    let showSetup = true;
    let appReady = false;
    let configCorrupt = "";
    let missingWorkspace = "";
    let otherTenants: TenantInfo[] = [];

    onDestroy(() => {
        stopNotificationScheduler();
        stopPomodoroTicker();
    });

    function initStores() {
        reinitStores();
        scheduleDailySnapshot();
        startNotificationScheduler();
    }

    onMount(() => {
        startPomodoroTicker();
        const navHandler = (e: Event) => { nav = (e as CustomEvent<string>).detail; };
        window.addEventListener('etasks:nav', navHandler);
        const navUnsub = navItemStore.subscribe(v => { nav = v; });

        // The snapshot is also due after midnight while the app stays open.
        const snapshotCheck = () => { if (appReady && !showSetup) scheduleDailySnapshot(); };
        const snapshotTimer = setInterval(snapshotCheck, 60 * 60 * 1000);
        const onVisible = () => { if (document.visibilityState === 'visible') snapshotCheck(); };
        document.addEventListener('visibilitychange', onVisible);

        (async () => {
            try {
                const config = await loadAppConfig();
                if (isTauriAvailable()) {
                    const status = configStatusStore.get();
                    if (status.status === "corrupt") {
                        logger.error(`config.json beschädigt: ${status.message}`);
                        configCorrupt = status.message ?? "Die Konfiguration ist beschädigt.";
                        return;
                    }
                    if (status.status === "recovered_from_backup") {
                        logger.warn(status.message ?? "config.json aus Sicherung wiederhergestellt");
                        toast(status.message ?? "Konfiguration aus der Sicherung wiederhergestellt.", "info", 8000);
                    }
                    const hasConfig = config.setup_done && !!config.active_tenant;
                    const dbExists = hasConfig
                        ? await command<boolean>("file_exists", { path: config.active_tenant })
                        : false;

                    if (!hasConfig || !dbExists) {
                        if (hasConfig && !dbExists) {
                            logger.warn(`DB nicht gefunden: ${config.active_tenant}`);
                            missingWorkspace = config.active_tenant!;
                            const others: TenantInfo[] = [];
                            for (const t of config.tenants) {
                                if (t.path !== config.active_tenant && (await command<boolean>("file_exists", { path: t.path }))) {
                                    others.push(t);
                                }
                            }
                            otherTenants = others;
                        } else {
                            logger.info("Erster Start — Setup-Wizard wird gezeigt");
                        }
                        showSetup = true;
                    } else {
                        logger.info(`Starte Tenant: ${config.active_tenant}`);
                        await activateTenant(config.active_tenant!);
                        showSetup = false;
                        logger.info("App bereit");
                    }
                } else {
                    initStores();
                    showSetup = false;
                }
            } catch (e) {
                logger.error(`App-Init fehlgeschlagen: ${e}`);
                showSetup = true;
            } finally {
                appReady = true;
            }
        })();

        function onKey(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                quickAddOpenStore.set(true);
            }
        }
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("keydown", onKey);
            window.removeEventListener('etasks:nav', navHandler);
            clearInterval(snapshotTimer);
            document.removeEventListener('visibilitychange', onVisible);
            navUnsub();
        };
    });

    async function onSetupDone() {
        showSetup = false;
        initStores();
    }

    async function onResetConfig() {
        try {
            await resetCorruptConfig();
            configCorrupt = "";
            showSetup = true;
        } catch (e) {
            toast(`Zurücksetzen fehlgeschlagen: ${e}`, "error", 6000);
        }
    }

    async function onChooseWorkspace(path: string) {
        try {
            await activateTenant(path);
            missingWorkspace = "";
            showSetup = false;
        } catch (e) {
            toast(`Wechsel des Arbeitsbereichs fehlgeschlagen: ${e}`, "error", 6000);
        }
    }
</script>

{#if appReady && !showSetup}
<div class="flex-1 overflow-hidden flex flex-col">
    {#if nav === "overview"}
        <div class="flex-1 overflow-hidden flex flex-col animate-fade-in" use:pageReveal>
            <OverviewView />
        </div>
    {/if}

    {#if nav === "today"}
        <div class="flex-1 overflow-hidden flex flex-col animate-fade-in" use:pageReveal>
            <TodayShell />
        </div>
    {/if}

    {#if nav === "week"}
        <div class="flex-1 overflow-hidden flex flex-col animate-fade-in" use:pageReveal={{ distance: 18 }}>
            <WeekView />
        </div>
    {/if}

    {#if nav === "projects"}<div class="flex-1 overflow-hidden animate-fade-in" use:pageReveal>
            <ProjectsView />
        </div>{/if}
    {#if nav === "time"}<div class="flex-1 overflow-hidden flex flex-col animate-fade-in" use:pageReveal>
            <TimeTrackingView />
        </div>{/if}
    {#if nav === "clients"}<div class="flex-1 overflow-hidden flex flex-col animate-fade-in" use:pageReveal>
            <ClientManager
                onProjectOpen={(projectId) => {
                    selectedProjectIdStore.set(projectId);
                    navItemStore.set("projects");
                }}
                emptyProjectsMessage="Noch keine Projekte für diesen Kunden."
            />
        </div>{/if}
    {#if nav === "invoices"}<div class="flex-1 overflow-hidden animate-fade-in" use:pageReveal>
            <ClientsView />
        </div>{/if}
    {#if nav === "services"}<div class="flex-1 overflow-hidden flex flex-col animate-fade-in" use:pageReveal>
            <ServiceCatalog />
        </div>{/if}
    {#if nav === "reports"}<div class="flex-1 overflow-hidden animate-fade-in" use:pageReveal>
            <ReportView />
        </div>{/if}
    {#if nav === "settings"}<div class="flex-1 overflow-hidden flex flex-col animate-fade-in" use:pageReveal>
            <SettingsView />
        </div>{/if}

    <QuickAddModal />
    <StaleTimerDialog />
</div>
{/if}

<ToastContainer />
<EnergyCheck />

{#if configCorrupt}
    <StartupProblem kind="config-corrupt" message={configCorrupt} onReset={onResetConfig} />
{:else if showSetup && missingWorkspace}
    <StartupProblem
        kind="workspace-missing"
        missingPath={missingWorkspace}
        tenants={otherTenants}
        onChoose={onChooseWorkspace}
        onSetup={() => (missingWorkspace = "")}
    />
{:else if showSetup}
    <SetupWizard onDone={onSetupDone} />
{/if}
