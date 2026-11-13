import { describe, expect, it } from "vitest";
import type { UserProfile } from "../stores/configStore";
import { fileSizeLabel, settingsEntries, snapshotDateLabel } from "./settingsStatus";

const full = {
  first_name: "Ada", last_name: "Lovelace", email: "ada@example.org", company: "Analytical", street: "Weg 1",
  zip: "10115", city: "Berlin", country: "DE", tax_id: "12/345/67890", iban: "DE02120300000000202051", hourly_rate: 80,
  invoice_number_prefix: "RE-2026-", payment_days: 14, shutdown_time: "17:00",
} as UserProfile;
const input = (profile: UserProfile, patch = {}) => ({ profile, workspaceName: "Büro", snapshot: "heute 08:02", desktop: true, ...patch });
const byId = (entries: ReturnType<typeof settingsEntries>, id: string) => entries.find((e) => e.id === id)!;

describe("settingsEntries", () => {
  it("is calm when everything is set", () => {
    const entries = settingsEntries(input(full));
    expect(entries.every((e) => e.tone === "ok")).toBe(true);
    expect(byId(entries, "profil").state).toBe("Vollständig");
    expect(byId(entries, "rechnungen").state).toBe("RE-2026-… · 14 Tage Zahlungsziel");
    expect(byId(entries, "tagesablauf").state).toBe("Abschluss 17:00");
    expect(byId(entries, "daten").state).toBe("Gesichert · heute 08:02");
  });

  it("names a single missing profile field and counts several", () => {
    expect(byId(settingsEntries(input({ ...full, iban: "" })), "profil")).toMatchObject({ state: "IBAN fehlt", tone: "warn" });
    expect(byId(settingsEntries(input({ ...full, iban: "", city: "" })), "profil").state).toBe("2 Angaben fehlen");
  });

  it("warns about missing number circle, shutdown time and backup", () => {
    const entries = settingsEntries(input({ ...full, invoice_number_prefix: "", shutdown_time: "" }, ), );
    expect(byId(entries, "rechnungen")).toMatchObject({ state: "Nummernkreis nicht gesetzt", tone: "warn" });
    expect(byId(entries, "tagesablauf").tone).toBe("warn");
    expect(byId(settingsEntries(input(full, { snapshot: null })), "daten")).toMatchObject({ state: "Noch nicht gesichert", tone: "warn" });
  });

  it("describes the browser mode", () => {
    const entries = settingsEntries(input(full, { desktop: false, workspaceName: null, snapshot: null }));
    expect(byId(entries, "arbeitsbereiche").state).toBe("Browser-Speicher");
    expect(byId(entries, "daten")).toMatchObject({ state: "Nur Export und Import", tone: "ok" });
  });
});

describe("labels", () => {
  it("formats date and size", () => {
    expect(snapshotDateLabel("2026-11-13")).toBe("13.11.2026");
    expect(fileSizeLabel(512)).toBe("512 B");
    expect(fileSizeLabel(20_480)).toBe("20 KB");
    expect(fileSizeLabel(1_572_864)).toBe("1,5 MB");
  });
});
