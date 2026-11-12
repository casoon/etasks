// @core
// Zahlenfelder des Profils vor dem Speichern prüfen: leer → Standard/undefined, ganze Zahlen für u32-Felder.
import type { UserProfile } from "../stores/configStore";

type NumberField =
  | "hourly_rate"
  | "payment_days"
  | "default_vat_rate"
  | "offer_validity_days"
  | "break_interval_minutes";

interface FieldRule {
  integer: boolean;
  max?: number;
  /** Wert bei leerem Feld; undefined = Feld bleibt ungesetzt. */
  fallback?: number;
}

const RULES: Record<NumberField, FieldRule> = {
  hourly_rate: { integer: false, fallback: 90 },
  payment_days: { integer: true },
  default_vat_rate: { integer: false, max: 100 },
  offer_validity_days: { integer: true },
  break_interval_minutes: { integer: true, max: 240 },
};

export type ProfileNumberErrors = Partial<Record<NumberField, string>>;

function checkValue(raw: unknown, rule: FieldRule): { value: number | undefined; error?: string } {
  if (raw === null || raw === undefined || raw === "") return { value: rule.fallback };
  const value = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(value)) return { value: undefined, error: "Bitte eine Zahl eingeben." };
  if (value < 0) return { value: undefined, error: "Der Wert darf nicht negativ sein." };
  if (rule.integer && !Number.isInteger(value)) {
    return { value: undefined, error: "Bitte eine ganze Zahl eingeben." };
  }
  if (rule.max !== undefined && value > rule.max) {
    return { value: undefined, error: `Der Wert darf höchstens ${rule.max} betragen.` };
  }
  return { value };
}

/** Liefert das bereinigte Profil und je fehlerhaftem Feld eine Meldung (Profil dann nicht speichern). */
export function normalizeProfileNumbers(profile: UserProfile): {
  profile: UserProfile;
  errors: ProfileNumberErrors;
} {
  const next: Record<string, unknown> = { ...profile };
  const errors: ProfileNumberErrors = {};
  for (const field of Object.keys(RULES) as NumberField[]) {
    const { value, error } = checkValue(next[field], RULES[field]);
    if (error) errors[field] = error;
    else next[field] = value;
  }
  return { profile: next as unknown as UserProfile, errors };
}
