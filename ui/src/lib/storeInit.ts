// @core
import { initTasks } from '../stores/taskStore';
import { initBlocks } from '../stores/calendarStore';
import { initProjects } from '../stores/projectStore';
import { initTimeEntries } from '../stores/timerStore';
import { initTemplates } from '../stores/templateStore';
import { initBillingItems } from '../stores/billingStore';
import { initServices } from '../stores/serviceStore';
import { initInvoices } from '../stores/invoiceStore';
import { initWeekPlans } from '../stores/weekPlanStore';
import { initGoals } from '../stores/weeklyGoalStore';
import { initTermine } from '../stores/terminStore';
import { initRecurringTasks } from './recurrenceService';
import { removeOrphanedBlocks } from './taskActions';
import { loadDayPlans } from './db';
import { $dayPlans } from '../stores/planningStore';

export function reinitStores(): void {
  initRecurringTasks();
  initTasks();
  initBlocks();
  removeOrphanedBlocks();
  initProjects();
  initTimeEntries();
  initTemplates();
  initBillingItems();
  initServices();
  initInvoices();
  initWeekPlans();
  initGoals();
  initTermine();
  $dayPlans.set(loadDayPlans());
}