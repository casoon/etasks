import { beforeEach, describe, expect, it, vi } from "vitest";

const parseBackup = vi.fn();
const applyBackup = vi.fn();
const writePreImportBackup = vi.fn();
const exportToFile = vi.fn();
const readSnapshot = vi.fn();
const toast = vi.fn();
const reinitStores = vi.fn();
const confirmFn = vi.fn();

vi.mock("./exportService", () => ({
  parseBackup,
  importSummary: () => [{ name: "tasks", current: 2, incoming: 1 }],
  applyBackup,
  writePreImportBackup,
  exportToFile,
  saveDailySnapshot: vi.fn(),
  readSnapshot,
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
    for (const m of [exportToFile, parseBackup, applyBackup, writePreImportBackup, toast, reinitStores, confirmFn]) m.mockReset();
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

describe("runExportWithFeedback", () => {
  beforeEach(() => {
    exportToFile.mockReset();
    toast.mockReset();
  });

  it("reports the written path", async () => {
    exportToFile.mockResolvedValue("/exports/x.json");
    const { runExportWithFeedback } = await import("./backupActions");
    await runExportWithFeedback();
    expect(toast).toHaveBeenCalledWith("Backup exportiert: /exports/x.json", "success", 6000);
  });

  it("reports a failing write as error instead of success", async () => {
    exportToFile.mockRejectedValue(new Error("Ordner nicht erreichbar"));
    const { runExportWithFeedback } = await import("./backupActions");
    await runExportWithFeedback();
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(expect.stringContaining("Ordner nicht erreichbar"), "error", 4500);
  });
});

describe("restoreFromSnapshot", () => {
  beforeEach(() => {
    for (const m of [readSnapshot, parseBackup, applyBackup, writePreImportBackup, toast, reinitStores, confirmFn]) m.mockReset();
    vi.stubGlobal("confirm", confirmFn);
    parseBackup.mockReturnValue({ lists: { tasks: [{ id: "x" }] } });
    confirmFn.mockReturnValue(true);
    writePreImportBackup.mockResolvedValue(null);
  });

  it("takes the listed file through the normal import path", async () => {
    readSnapshot.mockResolvedValue('{"data":{}}');
    const { restoreFromSnapshot } = await import("./backupActions");
    expect(await restoreFromSnapshot("snapshot-buro-2026-11-13.json")).toBe(true);
    expect(readSnapshot).toHaveBeenCalledWith("snapshot-buro-2026-11-13.json");
    expect(parseBackup).toHaveBeenCalledWith('{"data":{}}');
    expect(applyBackup).toHaveBeenCalled();
  });

  it("reports an unreadable file and imports nothing", async () => {
    readSnapshot.mockRejectedValue(new Error("weg"));
    const { restoreFromSnapshot } = await import("./backupActions");
    expect(await restoreFromSnapshot("snapshot-buro-2026-11-13.json")).toBe(false);
    expect(applyBackup).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringContaining("weg"), "error", 4500);
  });
});
