import { atom, computed } from 'nanostores';
import { invoke } from '@tauri-apps/api/core';
import { metaSet } from '../lib/metaStore';

export interface UserProfile {
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  tax_id: string;
  iban: string;
  hourly_rate: number;
  // Rechnungsgrunddaten
  invoice_number_prefix?: string; // z. B. "RE-2026-"
  invoice_number_counter?: number; // aktueller Zähler
  payment_days?: number;           // Zahlungsziel in Tagen, z. B. 14
  default_vat_rate?: number;       // Standard-MwSt. in %, z. B. 19
  bank_name?: string;
  bic?: string;
  invoice_footer_text?: string;    // z. B. "Vielen Dank für Ihren Auftrag."
}

export interface TenantInfo {
  path: string;
  name: string;
  displayName?: string;
  last_opened: string;
}

export interface AppConfig {
  version: number;
  setup_done: boolean;
  active_tenant: string | null;
  tenants: TenantInfo[];
  profile: UserProfile;
}

export const $appConfig = atom<AppConfig | null>(null);

export const $activeTenantName = computed($appConfig, (config) => {
  if (!config?.active_tenant) return '';
  const tenant = config.tenants.find(t => t.path === config.active_tenant);
  return tenant?.name ?? tenantNameFromPath(config.active_tenant ?? '');
});

export async function loadAppConfig(): Promise<AppConfig> {
  const config = await invoke<AppConfig>('load_config');
  $appConfig.set(config);
  return config;
}

export async function saveAppConfig(config: AppConfig): Promise<void> {
  await invoke('save_config', { config });
  $appConfig.set(config);
}

export async function openTenant(path: string, displayName?: string): Promise<void> {
  await invoke('db_open', { path });
  const config = $appConfig.get();
  if (!config) return;
  const now = new Date().toISOString();
  const name = displayName ?? tenantNameFromPath(path);
  const existing = config.tenants.find((t) => t.path === path);
  const tenants = existing
    ? config.tenants.map((t) => (t.path === path ? { ...t, name, displayName: displayName ?? t.displayName, last_opened: now } : t))
    : [...config.tenants, { path, name, displayName, last_opened: now }];
  await saveAppConfig({ ...config, active_tenant: path, tenants });
}

export function tenantNameFromPath(path: string): string {
  const filename = path.split('/').pop() ?? path;
  return filename.replace(/\.db$/i, '');
}

export async function writeTenantMeta(displayName: string, tenantType?: string): Promise<void> {
  const now = new Date().toISOString();
  await metaSet('tenant.name', displayName);
  await metaSet('tenant.display_name', displayName);
  if (tenantType) await metaSet('tenant.type', tenantType);
  await metaSet('defaults.currency', 'EUR');
  await metaSet('defaults.payment_term_days', '14');
  await metaSet('defaults.invoice_prefix', 'RE');
  await metaSet('app.schema_version', '1');
  await metaSet('app.created_at', now);
}

export async function removeTenant(path: string): Promise<void> {
  const config = $appConfig.get();
  if (!config) return;
  const tenants = config.tenants.filter(t => t.path !== path);
  await saveAppConfig({ ...config, tenants });
}
