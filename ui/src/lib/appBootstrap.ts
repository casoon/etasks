import { openTenant } from '../stores/configStore';
import { syncFromDatabase } from './storage';
import { reinitStores } from './storeInit';

/**
 * Opens a tenant, hydrates browser storage from SQLite, then reinitializes all stores.
 * This keeps tenant switching consistent across setup, settings, and sidebar UI.
 */
export async function activateTenant(path: string, displayName?: string): Promise<void> {
  await openTenant(path, displayName);
  await syncFromDatabase();
  reinitStores();
}
