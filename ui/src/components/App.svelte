<script lang="ts">
  import { onMount } from 'svelte';
  import { $navItem as navItemStore, $viewMode as viewModeStore, $quickAddOpen as quickAddOpenStore } from '../stores/uiStore';
  import { initTasks } from '../stores/taskStore';
  import { initBlocks } from '../stores/calendarStore';
  import { initGoals } from '../stores/weeklyGoalStore';
  import { initProjects } from '../stores/projectStore';
  import { initTimeEntries } from '../stores/timerStore';
  import { initTemplates } from '../stores/templateStore';
  import { initRecurringTasks } from '../lib/recurrenceService';
  import { scheduleDailySnapshot } from '../lib/exportService';
  import { loadAppConfig, openTenant } from '../stores/configStore';
  import { syncFromDatabase } from '../lib/storage';
  import { isTauriAvailable } from '../lib/platform';
  import TaskColumn from './TaskColumn.svelte';
  import CalendarView from './CalendarView.svelte';
  import WeeklyObjectives from './WeeklyObjectives.svelte';
  import PomodoroWidget from './PomodoroWidget.svelte';
  import ShutdownModal from './ShutdownModal.svelte';
  import AnalyticsView from './AnalyticsView.svelte';
  import ProjectsView from './ProjectsView.svelte';
  import BoardView from './BoardView.svelte';
  import TimeTrackingView from './TimeTrackingView.svelte';
  import ClientsView from './ClientsView.svelte';
  import QuickAddModal from './QuickAddModal.svelte';
  import SetupWizard from './SetupWizard.svelte';
  import SettingsView from './SettingsView.svelte';

  $: nav = $navItemStore;
  $: viewMode = $viewModeStore;
  $: isToday = nav === 'today' || nav === 'planning-daily';

  let showSetup = false;

  function initStores() {
    initTasks();
    initBlocks();
    initGoals();
    initProjects();
    initTimeEntries();
    initTemplates();
    initRecurringTasks();
    scheduleDailySnapshot();
  }

  onMount(async () => {
    if (isTauriAvailable()) {
      const config = await loadAppConfig();
      if (!config.setup_done || !config.active_tenant) {
        showSetup = true;
      } else {
        await openTenant(config.active_tenant);
        await syncFromDatabase();
        initStores();
      }
    } else {
      initStores();
    }

    function onKey(e: KeyboardEvent) {
      if (e.metaKey && e.key === 'k') { e.preventDefault(); quickAddOpenStore.set(true); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  async function onSetupDone() {
    showSetup = false;
    await syncFromDatabase();
    initStores();
  }
</script>

<div class="flex-1 overflow-hidden flex flex-col">
  {#if isToday && viewMode === 'day'}
    <div class="flex-1 grid overflow-hidden min-w-0" style="grid-template-columns: 200px minmax(260px, 320px) 1fr">
      <aside class="flex flex-col gap-4 p-4 border-r border-border overflow-y-auto min-w-0">
        <WeeklyObjectives />
      </aside>
      <TaskColumn />
      <CalendarView />
    </div>
  {/if}

  {#if isToday && viewMode === 'board'}
    <div class="flex-1 overflow-hidden flex flex-col">
      <BoardView />
    </div>
  {/if}

  {#if nav === 'focus'}
    <div class="flex-1 grid overflow-hidden overflow-y-auto p-6 gap-6 items-start" style="grid-template-columns: 280px 1fr">
      <PomodoroWidget />
      <TaskColumn />
    </div>
  {/if}

  {#if nav === 'planning-weekly'}
    <div class="flex-1 grid overflow-hidden" style="grid-template-columns: minmax(260px, 320px) 1fr">
      <WeeklyObjectives />
      <AnalyticsView />
    </div>
  {/if}

  {#if nav === 'projects'}<ProjectsView />{/if}
  {#if nav === 'time-tracking'}<TimeTrackingView />{/if}
  {#if nav === 'clients'}<ClientsView />{/if}
  {#if nav === 'settings'}<SettingsView />{/if}

  <QuickAddModal />
  <ShutdownModal />
</div>

{#if showSetup}
  <SetupWizard onDone={onSetupDone} />
{/if}
