<!-- @core -->
<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import {
        $navItem as navItemStore,
        $quickAddOpen as quickAddOpenStore,
    } from "../../stores/uiStore";
    import { reinitStores } from "../../lib/storeInit";
    import { scheduleDailySnapshot } from "../../lib/exportService";
    import { loadAppConfig } from "../../stores/configStore";
    import { activateTenant } from "../../lib/appBootstrap";
    import { isTauriAvailable } from "../../lib/platform";
    import { invoke } from "@tauri-apps/api/core";
    import { startNotificationScheduler, stopNotificationScheduler } from "../../lib/notificationScheduler";
    import { logger } from "../../lib/logger";
    import TodayView from "../views/TodayView.svelte";
    import WeeklyPlanningView from "../views/WeeklyPlanningView.svelte";
    import PomodoroWidget from "../widgets/PomodoroWidget.svelte";
    import TaskColumn from "../widgets/TaskColumn.svelte";
    import ShutdownModal from "../modals/ShutdownModal.svelte";
    import AnalyticsView from "../views/AnalyticsView.svelte";
    import ProjectsView from "../views/ProjectsView.svelte";
    import TimeTrackingView from "../views/TimeTrackingView.svelte";
    import ClientsView from "../views/ClientsView.svelte";
    import QuickAddModal from "../modals/QuickAddModal.svelte";
    import SetupWizard from "./SetupWizard.svelte";
    import SettingsView from "../views/SettingsView.svelte";
    import DailyPlanningView from "../views/DailyPlanningView.svelte";
    import ReportView from "../views/ReportView.svelte";
    import ToastContainer from "../shared/ToastContainer.svelte";
    import EnergyCheck from "../modals/EnergyCheck.svelte";
    import { pageReveal } from "../../lib/motionActions";

    let nav: string = navItemStore.get();

    // Default: show setup overlay until we verify the app state
    let showSetup = true;
    let appReady = false;

    onDestroy(stopNotificationScheduler);

    function initStores() {
        reinitStores();
        scheduleDailySnapshot();
        startNotificationScheduler();
    }

    onMount(() => {
        const navHandler = (e: Event) => { nav = (e as CustomEvent<string>).detail; };
        window.addEventListener('etasks:nav', navHandler);
        const navUnsub = navItemStore.subscribe(v => { nav = v; });

        (async () => {
            try {
                const config = await loadAppConfig();
                if (isTauriAvailable()) {
                    const hasConfig = config.setup_done && !!config.active_tenant;
                    const dbExists = hasConfig
                        ? await invoke<boolean>("file_exists", { path: config.active_tenant })
                        : false;

                    if (!hasConfig || !dbExists) {
                        if (hasConfig && !dbExists) {
                            logger.warn(`DB nicht gefunden: ${config.active_tenant} — Setup neu starten`);
                            const { saveAppConfig } = await import("../../stores/configStore");
                            await saveAppConfig({ ...config, setup_done: false, active_tenant: null });
                        } else {
                            logger.info("Erster Start — Setup-Wizard wird gezeigt");
                        }
                        showSetup = true;
                    } else {
                        logger.info(`Starte Tenant: ${config.active_tenant}`);
                        await activateTenant(config.active_tenant!);
                        scheduleDailySnapshot();
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
            if (e.metaKey && e.key === "k") {
                e.preventDefault();
                quickAddOpenStore.set(true);
            }
        }
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("keydown", onKey);
            window.removeEventListener('etasks:nav', navHandler);
            navUnsub();
        };
    });

    async function onSetupDone() {
        showSetup = false;
        initStores();
    }
</script>

{#if appReady && !showSetup}
<div class="flex-1 overflow-hidden flex flex-col">
    {#if nav === "today"}
        <div class="flex-1 overflow-hidden flex flex-col animate-fade-in">
            <div class="flex-1 overflow-hidden" use:pageReveal>
                <TodayView />
            </div>
        </div>
    {/if}

    {#if nav === "focus"}
        <div
            class="flex-1 grid overflow-hidden overflow-y-auto p-6 gap-6 items-start animate-fade-in"
            style="grid-template-columns: 280px 1fr"
            use:pageReveal={{ distance: 18 }}
        >
            <PomodoroWidget />
            <TaskColumn />
        </div>
    {/if}

    {#if nav === "planning-weekly"}
        <div
            class="flex-1 grid overflow-hidden animate-fade-in"
            style="grid-template-columns: minmax(280px, 340px) 1fr"
            use:pageReveal={{ distance: 18 }}
        >
            <div class="border-r border-border overflow-hidden flex flex-col">
                <WeeklyPlanningView />
            </div>
            <AnalyticsView />
        </div>
    {/if}

    {#if nav === "planning-daily"}<div
            class="flex-1 overflow-hidden animate-fade-in"
            use:pageReveal
        >
            <DailyPlanningView />
        </div>{/if}
    {#if nav === "projects"}<div class="flex-1 overflow-hidden animate-fade-in" use:pageReveal>
            <ProjectsView />
        </div>{/if}
    {#if nav === "time-tracking"}<div
            class="flex-1 overflow-hidden animate-fade-in"
            use:pageReveal
        >
            <TimeTrackingView />
        </div>{/if}
    {#if nav === "clients"}<div class="flex-1 overflow-hidden animate-fade-in" use:pageReveal>
            <ClientsView />
        </div>{/if}
    {#if nav === "report"}<div class="flex-1 overflow-hidden animate-fade-in" use:pageReveal>
            <ReportView />
        </div>{/if}
    {#if nav === "settings"}<div class="flex-1 overflow-hidden flex flex-col animate-fade-in" use:pageReveal>
            <SettingsView />
        </div>{/if}

    <QuickAddModal />
    <ShutdownModal />
</div>
{/if}

<ToastContainer />
<EnergyCheck />

{#if showSetup}
    <SetupWizard onDone={onSetupDone} />
{/if}
