// @core
import { missingPdfProfileFields, type UserProfile } from "../stores/configStore";

export type SettingsSectionId = "profil" | "rechnungen" | "tagesablauf" | "arbeitsbereiche" | "daten";

export interface SettingsEntry {
  id: SettingsSectionId;
  label: string;
  /** Second line of the sub-navigation entry. */
  state: string;
  /** warn marks something that is missing and blocks or limits a feature. */
  tone: "ok" | "warn";
}

export interface SettingsStatusInput {
  profile: UserProfile;
  workspaceName: string | null;
  /** Text after „Gesichert · “ (see snapshotLabel), null when no snapshot is known. */
  snapshot: string | null;
  desktop: boolean;
}

/** Entries of the settings sub-navigation with their state line, e.g. „IBAN fehlt“. */
export function settingsEntries({ profile, workspaceName, snapshot, desktop }: SettingsStatusInput): SettingsEntry[] {
  const missing = missingPdfProfileFields(profile);
  const prefix = profile.invoice_number_prefix?.trim();
  const shutdown = profile.shutdown_time?.trim();
  return [
    {
      id: "profil",
      label: "Profil",
      state: missing.length === 0 ? "Vollständig" : missing.length === 1 ? `${missing[0]} fehlt` : `${missing.length} Angaben fehlen`,
      tone: missing.length === 0 ? "ok" : "warn",
    },
    {
      id: "rechnungen",
      label: "Rechnungen und Angebote",
      state: prefix ? `${prefix}… · ${profile.payment_days ?? 14} Tage Zahlungsziel` : "Nummernkreis nicht gesetzt",
      tone: prefix ? "ok" : "warn",
    },
    {
      id: "tagesablauf",
      label: "Tagesablauf",
      state: shutdown ? `Abschluss ${shutdown}` : "Abschlusszeit nicht gesetzt",
      tone: shutdown ? "ok" : "warn",
    },
    {
      id: "arbeitsbereiche",
      label: "Arbeitsbereiche",
      state: workspaceName ?? (desktop ? "Kein Arbeitsbereich" : "Browser-Speicher"),
      tone: "ok",
    },
    {
      id: "daten",
      label: "Daten und Sicherung",
      state: !desktop ? "Nur Export und Import" : snapshot ? `Gesichert · ${snapshot}` : "Noch nicht gesichert",
      tone: !desktop || snapshot ? "ok" : "warn",
    },
  ];
}

/** `2026-11-13` → `13.11.2026` for the backup list. */
export function snapshotDateLabel(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}

/** `12 KB`, `1,4 MB` for a file size. */
export function fileSizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
}
