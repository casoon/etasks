// @core
import { command } from '@casoon/origin-client';
import { openTenant } from '../stores/configStore';
import { syncFromDatabase } from './storage';
import { reinitStores } from './storeInit';
import { startNotificationScheduler } from './notificationScheduler';
import { scheduleDailySnapshot } from './exportService';

/**
 * Opens a tenant, hydrates browser storage from SQLite, then reinitializes all stores.
 * This keeps tenant switching consistent across setup, settings, and sidebar UI.
 */
export async function activateTenant(path: string, displayName?: string): Promise<void> {
  await openTenant(path, displayName);
  await syncFromDatabase();
  reinitStores();
  startNotificationScheduler();
  void scheduleDailySnapshot();
}

/** True, wenn die Datenbankdatei des Arbeitsbereichs noch existiert (db_open würde sonst eine leere anlegen). */
export async function tenantDbExists(path: string): Promise<boolean> {
  return command<boolean>('file_exists', { path });
}
