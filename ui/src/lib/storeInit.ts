import { initTasks } from '../stores/taskStore';
import { initBlocks } from '../stores/calendarStore';
import { initGoals } from '../stores/weeklyGoalStore';
import { initProjects } from '../stores/projectStore';
import { initTimeEntries } from '../stores/timerStore';
import { initTemplates } from '../stores/templateStore';
import { initBillingItems } from '../stores/billingStore';
import { initServices } from '../stores/serviceStore';
import { initInvoices } from '../stores/invoiceStore';
import { initRecurringTasks } from './recurrenceService';
import { loadDayPlans } from './db';
import { $dayPlans } from '../stores/planningStore';

export function reinitStores(): void {
  initTasks();
  initBlocks();
  initGoals();
  initProjects();
  initTimeEntries();
  initTemplates();
  initBillingItems();
  initServices();
  initInvoices();
  initRecurringTasks();
  $dayPlans.set(loadDayPlans());
}
