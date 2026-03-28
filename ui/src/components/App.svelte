<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import {
        $navItem as navItemStore,
        $quickAddOpen as quickAddOpenStore,
    } from "../stores/uiStore";
    import { reinitStores } from "../lib/storeInit";
    import { scheduleDailySnapshot } from "../lib/exportService";
    import { loadAppConfig } from "../stores/configStore";
    import { activateTenant } from "../lib/appBootstrap";
    import { isTauriAvailable } from "../lib/platform";
    import { invoke } from "@tauri-apps/api/core";
    import { startNotificationScheduler, stopNotificationScheduler } from "../lib/notificationScheduler";
    import TodayView from "./TodayView.svelte";
    import WeeklyObjectives from "./WeeklyObjectives.svelte";
    import PomodoroWidget from "./PomodoroWidget.svelte";
    import TaskColumn from "./TaskColumn.svelte";
    import ShutdownModal from "./ShutdownModal.svelte";
    import AnalyticsView from "./AnalyticsView.svelte";
    import ProjectsView from "./ProjectsView.svelte";
    import TimeTrackingView from "./TimeTrackingView.svelte";
    import ClientsView from "./ClientsView.svelte";
    import QuickAddModal from "./QuickAddModal.svelte";
    import SetupWizard from "./SetupWizard.svelte";
    import SettingsView from "./SettingsView.svelte";
    import DailyPlanningView from "./DailyPlanningView.svelte";
    import ToastContainer from "./ToastContainer.svelte";
    import EnergyCheck from "./EnergyCheck.svelte";

    let nav: string = navItemStore.get();

    onDestroy(
        navItemStore.subscribe((v) => {
            nav = v;
        }),
    );

    // Default: show setup overlay until we verify the app state
    let showSetup = true;
    let appReady = false;

    onDestroy(stopNotificationScheduler);

    function initStores() {
        reinitStores();
        scheduleDailySnapshot();
        startNotificationScheduler();
    }

    onMount(async () => {
        const config = await loadAppConfig();
        if (isTauriAvailable()) {
            const hasConfig = config.setup_done && !!config.active_tenant;
            const dbExists = hasConfig
                ? await invoke<boolean>("file_exists", { path: config.active_tenant })
                : false;

            if (!hasConfig || !dbExists) {
                // Reset setup_done if DB is gone so wizard starts fresh
                if (hasConfig && !dbExists) {
                    // The config says done but the DB file is missing — re-run wizard
                    const { saveAppConfig } = await import("../stores/configStore");
                    await saveAppConfig({ ...config, setup_done: false, active_tenant: null });
                }
                showSetup = true;
                appReady = true;
            } else {
                await activateTenant(config.active_tenant);
                scheduleDailySnapshot();
                showSetup = false;
                appReady = true;
            }
        } else {
            initStores();
            showSetup = false;
            appReady = true;
        }

        function onKey(e: KeyboardEvent) {
            if (e.metaKey && e.key === "k") {
                e.preventDefault();
                quickAddOpenStore.set(true);
            }
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
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
            <TodayView />
        </div>
    {/if}

    {#if nav === "focus"}
        <div
            class="flex-1 grid overflow-hidden overflow-y-auto p-6 gap-6 items-start animate-fade-in"
            style="grid-template-columns: 280px 1fr"
        >
            <PomodoroWidget />
            <TaskColumn />
        </div>
    {/if}

    {#if nav === "planning-weekly"}
        <div
            class="flex-1 grid overflow-hidden animate-fade-in"
            style="grid-template-columns: minmax(260px, 320px) 1fr"
        >
            <WeeklyObjectives />
            <AnalyticsView />
        </div>
    {/if}

    {#if nav === "planning-daily"}<div
            class="flex-1 overflow-hidden animate-fade-in"
        >
            <DailyPlanningView />
        </div>{/if}
    {#if nav === "projects"}<div class="flex-1 overflow-hidden animate-fade-in">
            <ProjectsView />
        </div>{/if}
    {#if nav === "time-tracking"}<div
            class="flex-1 overflow-hidden animate-fade-in"
        >
            <TimeTrackingView />
        </div>{/if}
    {#if nav === "clients"}<div class="flex-1 overflow-hidden animate-fade-in">
            <ClientsView />
        </div>{/if}
    {#if nav === "settings"}<div class="flex-1 overflow-hidden flex flex-col animate-fade-in">
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
