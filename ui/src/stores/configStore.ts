import { atom, computed } from "nanostores";
import { invoke } from "@tauri-apps/api/core";
import { metaSet } from "../lib/metaStore";
import { isTauriAvailable } from "../lib/platform";

export interface UserProfile {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  website?: string;
  logo?: string;
  logo_width?: string;
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
  offer_number_prefix?: string;
  offer_number_counter?: number;
  offer_validity_days?: number;
  offer_payment_terms?: string;
  offer_delivery_terms?: string;
  offer_additional_terms?: string;
  payment_days?: number; // Zahlungsziel in Tagen, z. B. 14
  default_vat_rate?: number; // Standard-MwSt. in %, z. B. 19
  bank_name?: string;
  bic?: string;
  invoice_footer_text?: string; // z. B. "Vielen Dank für Ihren Auftrag."
  // Benachrichtigungen & Tagesrhythmus
  shutdown_time?: string; // "HH:MM", z. B. "17:00"
  break_interval_minutes?: number; // Pausen-Erinnerung alle N Minuten, 0 = deaktiviert
  // KI-Integration
  claude_api_key?: string; // Anthropic API Key für KI-Zusammenfassungen
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

const WEB_CONFIG_KEY = "etasks.app-config";

export function createDefaultUserProfile(): UserProfile {
  return {
    first_name: "Max",
    last_name: "Mustermann",
    email: "max@musterfirma.de",
    phone: "",
    website: "",
    logo: "",
    logo_width: "3cm",
    company: "Musterfirma GmbH",
    street: "Musterstraße 1",
    zip: "12345",
    city: "Musterstadt",
    country: "Deutschland",
    tax_id: "DE123456789",
    iban: "DE89 3704 0044 0532 0130 00",
    hourly_rate: 90,
    invoice_number_prefix: "RE-",
    invoice_number_counter: 1,
    offer_number_prefix: "ANG-",
    offer_number_counter: 1,
    offer_validity_days: 30,
    offer_payment_terms:
      "Zahlbar innerhalb von 14 Tagen nach Rechnungsstellung ohne Abzug.",
    offer_delivery_terms: "",
    offer_additional_terms: "",
    payment_days: 14,
    default_vat_rate: 19,
    bank_name: "",
    bic: "",
    invoice_footer_text: "",
    shutdown_time: "17:00",
    break_interval_minutes: 90,
  };
}

export function createDefaultAppConfig(): AppConfig {
  return {
    version: 1,
    setup_done: false,
    active_tenant: null,
    tenants: [],
    profile: createDefaultUserProfile(),
  };
}

function normalizeConfig(
  config: Partial<AppConfig> | null | undefined,
): AppConfig {
  const defaults = createDefaultAppConfig();
  return {
    ...defaults,
    ...(config ?? {}),
    tenants: config?.tenants ?? defaults.tenants,
    profile: {
      ...defaults.profile,
      ...(config?.profile ?? {}),
    },
  };
}

function loadWebConfig(): AppConfig {
  if (typeof localStorage === "undefined") return createDefaultAppConfig();
  try {
    const raw = localStorage.getItem(WEB_CONFIG_KEY);
    return raw
      ? normalizeConfig(JSON.parse(raw) as Partial<AppConfig>)
      : createDefaultAppConfig();
  } catch {
    return createDefaultAppConfig();
  }
}

function saveWebConfig(config: AppConfig): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(WEB_CONFIG_KEY, JSON.stringify(config));
}

export const $appConfig = atom<AppConfig>(createDefaultAppConfig());

export const $activeTenantName = computed($appConfig, (config) => {
  if (!config?.active_tenant) return "";
  const tenant = config.tenants.find((t) => t.path === config.active_tenant);
  return tenant?.name ?? tenantNameFromPath(config.active_tenant ?? "");
});

export async function loadAppConfig(): Promise<AppConfig> {
  const config = isTauriAvailable()
    ? normalizeConfig(await invoke<AppConfig>("load_config"))
    : loadWebConfig();
  $appConfig.set(config);
  return config;
}

export async function saveAppConfig(config: AppConfig): Promise<void> {
  const normalized = normalizeConfig(config);
  if (isTauriAvailable()) {
    await invoke("save_config", { config: normalized });
  } else {
    saveWebConfig(normalized);
  }
  $appConfig.set(normalized);
}

export async function openTenant(
  path: string,
  displayName?: string,
): Promise<void> {
  await invoke("db_open", { path });
  const config = $appConfig.get();
  const now = new Date().toISOString();
  const name = displayName ?? tenantNameFromPath(path);
  const existing = config.tenants.find((t) => t.path === path);
  const tenants = existing
    ? config.tenants.map((t) =>
        t.path === path
          ? {
              ...t,
              name,
              displayName: displayName ?? t.displayName,
              last_opened: now,
            }
          : t,
      )
    : [...config.tenants, { path, name, displayName, last_opened: now }];
  await saveAppConfig({ ...config, active_tenant: path, tenants });
}

export function tenantNameFromPath(path: string): string {
  const filename = path.split("/").pop() ?? path;
  return filename.replace(/\.db$/i, "");
}

export async function writeTenantMeta(
  displayName: string,
  tenantType?: string,
): Promise<void> {
  const now = new Date().toISOString();
  await metaSet("tenant.name", displayName);
  await metaSet("tenant.display_name", displayName);
  if (tenantType) await metaSet("tenant.type", tenantType);
  await metaSet("defaults.currency", "EUR");
  await metaSet("defaults.payment_term_days", "14");
  await metaSet("defaults.invoice_prefix", "RE");
  await metaSet("app.schema_version", "1");
  await metaSet("app.created_at", now);
}

export async function removeTenant(path: string): Promise<void> {
  const config = $appConfig.get();
  const tenants = config.tenants.filter((t) => t.path !== path);
  const active_tenant =
    config.active_tenant === path
      ? (tenants[0]?.path ?? null)
      : config.active_tenant;
  await saveAppConfig({ ...config, active_tenant, tenants });
}
