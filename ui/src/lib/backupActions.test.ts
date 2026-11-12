import { beforeEach, describe, expect, it, vi } from "vitest";

const parseBackup = vi.fn();
const applyBackup = vi.fn();
const writePreImportBackup = vi.fn();
const toast = vi.fn();
const reinitStores = vi.fn();
const confirmFn = vi.fn();

vi.mock("./exportService", () => ({
  parseBackup,
  importSummary: () => [{ name: "tasks", current: 2, incoming: 1 }],
  applyBackup,
  writePreImportBackup,
  exportToFile: vi.fn(),
  saveToICloud: vi.fn(),
}));
vi.mock("./storeInit", () => ({ reinitStores }));
vi.mock("../stores/toastStore", () => ({ toast }));
vi.mock("./platform", () => ({ isTauriAvailable: () => true, isMac: () => true }));
vi.mock("../stores/configStore", () => ({
  $appConfig: { get: () => ({ active_tenant: "/a.db", tenants: [{ path: "/a.db", name: "Büro" }] }) },
}));

const file = { name: "b.json", text: async () => "{}" } as unknown as File;

describe("restoreFromBackupFile", () => {
  beforeEach(() => {
    for (const m of [parseBackup, applyBackup, writePreImportBackup, toast, reinitStores, confirmFn]) m.mockReset();
    vi.stubGlobal("confirm", confirmFn);
    parseBackup.mockReturnValue({ lists: { tasks: [{ id: "x" }] } });
    confirmFn.mockReturnValue(true);
    writePreImportBackup.mockResolvedValue("/exports/vor-import.json");
  });

  it("rejects an invalid file without asking or writing", async () => {
    parseBackup.mockReturnValue({ error: "kaputt" });
    const { restoreFromBackupFile } = await import("./backupActions");
    expect(await restoreFromBackupFile(file)).toBe(false);
    expect(confirmFn).not.toHaveBeenCalled();
    expect(applyBackup).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringContaining("kaputt"), "error", 4500);
  });

  it("does nothing when the user declines", async () => {
    confirmFn.mockReturnValue(false);
    const { restoreFromBackupFile } = await import("./backupActions");
    expect(await restoreFromBackupFile(file)).toBe(false);
    expect(writePreImportBackup).not.toHaveBeenCalled();
    expect(applyBackup).not.toHaveBeenCalled();
  });

  it("aborts the import when the pre-import backup cannot be written", async () => {
    writePreImportBackup.mockRejectedValue(new Error("Ordner nicht erreichbar"));
    const { restoreFromBackupFile } = await import("./backupActions");
    expect(await restoreFromBackupFile(file)).toBe(false);
    expect(applyBackup).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringContaining("abgebrochen"), "error", 6000);
  });

  it("confirms with counts, backs up, then imports", async () => {
    const { restoreFromBackupFile } = await import("./backupActions");
    expect(await restoreFromBackupFile(file)).toBe(true);
    expect(confirmFn.mock.calls[0][0]).toContain("Aufgaben: 2 vorhanden, 1 in der Datei");
    expect(writePreImportBackup.mock.invocationCallOrder[0]).toBeLessThan(applyBackup.mock.invocationCallOrder[0]);
    expect(reinitStores).toHaveBeenCalled();
  });
});
