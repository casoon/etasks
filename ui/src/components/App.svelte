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

    let nav: string = navItemStore.get();

    onDestroy(
        navItemStore.subscribe((v) => {
            nav = v;
        }),
    );

    let showSetup = false;

    function initStores() {
        reinitStores();
        scheduleDailySnapshot();
    }

    onMount(async () => {
        const config = await loadAppConfig();
        if (isTauriAvailable()) {
            if (!config.setup_done || !config.active_tenant) {
                showSetup = true;
            } else {
                await activateTenant(config.active_tenant);
                scheduleDailySnapshot();
            }
        } else {
            initStores();
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
    {#if nav === "settings"}<div class="flex-1 overflow-hidden animate-fade-in">
            <SettingsView />
        </div>{/if}

    <QuickAddModal />
    <ShutdownModal />
</div>

<ToastContainer />

{#if showSetup}
    <SetupWizard onDone={onSetupDone} />
{/if}
