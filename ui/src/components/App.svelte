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

  $: nav = $navItemStore;
  $: viewMode = $viewModeStore;
  $: isToday = nav === 'today' || nav === 'planning-daily';

  onMount(() => {
    initTasks();
    initBlocks();
    initGoals();
    initProjects();
    initTimeEntries();
    initTemplates();
    initRecurringTasks();
    scheduleDailySnapshot();

    function onKey(e: KeyboardEvent) {
      if (e.metaKey && e.key === 'k') { e.preventDefault(); quickAddOpenStore.set(true); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
</script>

<div class="app-content">
  {#if isToday && viewMode === 'day'}
    <div class="main-layout">
      <aside class="sidebar-widgets">
        <WeeklyObjectives />
      </aside>
      <TaskColumn />
      <CalendarView />
    </div>
  {/if}

  {#if isToday && viewMode === 'board'}
    <div class="board-layout">
      <BoardView />
    </div>
  {/if}

  {#if nav === 'focus'}
    <div class="focus-layout">
      <PomodoroWidget />
      <TaskColumn />
    </div>
  {/if}

  {#if nav === 'planning-weekly'}
    <div class="weekly-layout">
      <WeeklyObjectives />
      <AnalyticsView />
    </div>
  {/if}

  {#if nav === 'projects'}<ProjectsView />{/if}
  {#if nav === 'time-tracking'}<TimeTrackingView />{/if}
  {#if nav === 'clients'}<ClientsView />{/if}

  <QuickAddModal />
  <ShutdownModal />
</div>
