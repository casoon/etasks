import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();

let tauri = true;
const command = vi.fn();
const syncFromDatabase = vi.fn();

vi.mock("./platform", () => ({
  isTauriAvailable: () => tauri,
}));

vi.mock("@casoon/origin-client", () => ({
  command,
}));

vi.mock("./storage", () => ({
  KEYS: {
    tasks: "etasks:tasks",
    blocks: "etasks:blocks",
    goals: "etasks:goals",
    notes: "etasks:notes",
    clients: "etasks:clients",
    projects: "etasks:projects",
    timeEntries: "etasks:timeEntries",
    templates: "etasks:templates",
    exportMeta: "etasks:exportMeta",
    billingItems: "etasks:billingItems",
    billingItemTasks: "etasks:billingItemTasks",
    dayPlans: "etasks:dayPlans",
    services: "etasks:services",
    invoices: "etasks:invoices",
    weekPlans: "etasks:weekPlans",
    termine: "etasks:termine",
  },
  syncFromDatabase,
  storageGet: (key: string) => {
    const raw = storage.get(key);
    return raw ? JSON.parse(raw) : null;
  },
  storageSet: (key: string, value: unknown) => {
    storage.set(key, JSON.stringify(value));
  },
}));

vi.mock("./db", () => ({
  loadTasks: () => [{ id: "task-1" }],
  loadBlocks: () => [{ id: "block-1" }],
  loadGoals: () => [{ id: "goal-1" }],
  loadNotes: () => [{ date: "2026-03-28" }],
  loadClients: () => [{ id: "client-1" }],
  loadProjects: () => [{ id: "project-1" }],
  loadTimeEntries: () => [{ id: "entry-1" }],
  loadCustomTemplates: () => [{ id: "template-1" }],
  loadBillingItems: () => [{ id: "billing-1" }],
  loadBillingItemTasks: () => [
    { billingItemId: "billing-1", taskId: "task-1" },
  ],
  loadDayPlans: () => [{ id: "plan-1", date: "2026-03-28" }],
  loadTermine: () => [{ id: "termin-1" }],
  loadWeekPlans: () => [{ weekStart: "2026-03-23", focusProjectIds: [] }],
}));

vi.mock("../stores/coreBridge", () => ({
  $bridgeServices: { get: () => [{ id: "service-1" }] },
  $bridgeInvoices: { get: () => [{ id: "invoice-1" }] },
}));

vi.mock("../stores/configStore", () => ({
  $appConfig: {
    get: () => ({
      profile: { company: "Test Co", iban: "DE00", tax_id: "123", bank_name: "Bank", bic: "BIC" },
      active_tenant: "/ws/a.db",
      tenants: [{ path: "/ws/a.db", name: "a", displayName: "Büro Müller & Söhne" }],
    }),
  },
}));

vi.mock("./metaStore", () => ({
  metaAll: async () => [
    { key: "tenant.name", value: "Test Co", valueType: "string" },
  ],
}));

describe("exportService", () => {
  beforeEach(() => {
    storage.clear();
    tauri = true;
    command.mockReset();
    syncFromDatabase.mockReset();
  });

  it("builds a full snapshot for all persisted entities", async () => {
    const { buildSnapshot } = await import("./exportService");
    const snapshot = await buildSnapshot();

    expect(snapshot.data).toMatchObject({
      tasks: [{ id: "task-1" }],
      blocks: [{ id: "block-1" }],
      goals: [{ id: "goal-1" }],
      notes: [{ date: "2026-03-28" }],
      clients: [{ id: "client-1" }],
      projects: [{ id: "project-1" }],
      services: [{ id: "service-1" }],
      timeEntries: [{ id: "entry-1" }],
      templates: [{ id: "template-1" }],
      billingItems: [{ id: "billing-1" }],
      billingItemTasks: [{ billingItemId: "billing-1", taskId: "task-1" }],
      dayPlans: [{ id: "plan-1", date: "2026-03-28" }],
      invoices: [{ id: "invoice-1" }],
      termine: [{ id: "termin-1" }],
      weekPlans: [{ weekStart: "2026-03-23", focusProjectIds: [] }],
    });
    expect(snapshot.profile).toMatchObject({ company: "Test Co" });
    expect(snapshot.tenantMeta).toEqual([
      { key: "tenant.name", value: "Test Co", valueType: "string" },
    ]);
  });

  it("imports all persisted entities from JSON", async () => {
    tauri = false;
    const { importFromJSON } = await import("./exportService");

    const ok = await importFromJSON(
      JSON.stringify({
        profile: { company: "Restored Co" },
        tenantMeta: [
          { key: "tenant.name", value: "Restored Co", valueType: "string" },
        ],
        data: {
          tasks: [{ id: "task-2" }],
          blocks: [{ id: "block-2" }],
          goals: [{ id: "goal-2" }],
          notes: [{ date: "2026-03-29" }],
          clients: [{ id: "client-2" }],
          projects: [{ id: "project-2" }],
          services: [{ id: "service-2" }],
          timeEntries: [{ id: "entry-2" }],
          templates: [{ id: "template-2" }],
          billingItems: [{ id: "billing-2", projectId: "project-2" }],
          billingItemTasks: [
            { billingItemId: "billing-2", taskId: "task-2", createdAt: "2026-03-29T10:00:00Z" },
          ],
          dayPlans: [{ id: "plan-2", date: "2026-03-29" }],
          invoices: [{ id: "invoice-2" }],
          termine: [{ id: "termin-2" }],
          weekPlans: [{ weekStart: "2026-03-30", focusProjectIds: ["project-2"] }],
        },
      }),
    );

    expect(ok).toBe(true);
    expect(JSON.parse(storage.get("etasks:services") ?? "null")).toEqual([
      { id: "service-2" },
    ]);
    expect(JSON.parse(storage.get("etasks:templates") ?? "null")).toEqual([
      { id: "template-2" },
    ]);
    expect(JSON.parse(storage.get("etasks:billingItems") ?? "null")).toEqual([
      { id: "billing-2", projectId: "project-2" },
    ]);
    expect(
      JSON.parse(storage.get("etasks:billingItemTasks") ?? "null"),
    ).toEqual([
      { billingItemId: "billing-2", taskId: "task-2", createdAt: "2026-03-29T10:00:00Z" },
    ]);
    expect(JSON.parse(storage.get("etasks:dayPlans") ?? "null")).toEqual([
      { id: "plan-2", date: "2026-03-29" },
    ]);
    expect(JSON.parse(storage.get("etasks:invoices") ?? "null")).toEqual([
      { id: "invoice-2" },
    ]);
    expect(JSON.parse(storage.get("etasks:termine") ?? "null")).toEqual([
      { id: "termin-2" },
    ]);
    expect(JSON.parse(storage.get("etasks:weekPlans") ?? "null")).toEqual([
      { weekStart: "2026-03-30", focusProjectIds: ["project-2"] },
    ]);
  });

  it("still imports backups without termine and weekPlans", async () => {
    tauri = false;
    const { importFromJSON } = await import("./exportService");
    const ok = await importFromJSON(
      JSON.stringify({ data: { tasks: [{ id: "task-3" }] } }),
    );
    expect(ok).toBe(true);
    expect(storage.has("etasks:termine")).toBe(false);
  });

  it("writes SQLite first and leaves local storage to the DB refresh", async () => {
    storage.set("etasks:invoices", JSON.stringify([{ id: "old" }]));
    const { importFromJSON } = await import("./exportService");

    const ok = await importFromJSON(
      JSON.stringify({
        profile: { company: "Other" },
        tenantMeta: [{ key: "tenant.name", value: "Other", valueType: "string" }],
        data: { tasks: [{ id: "task-4" }], termine: [{ id: "termin-4" }] },
      }),
    );

    expect(ok).toBe(true);
    expect(command).toHaveBeenCalledWith("import_snapshot", {
      payload: { tasks: [{ id: "task-4" }], termine: [{ id: "termin-4" }] },
    });
    expect(syncFromDatabase).toHaveBeenCalledTimes(1);
    expect(storage.get("etasks:invoices")).toBe(JSON.stringify([{ id: "old" }]));
    expect(storage.has("etasks:tasks")).toBe(false);
  });

  it("does not touch local storage when the DB import fails", async () => {
    command.mockRejectedValueOnce(new Error("database is locked"));
    const { importFromJSON } = await import("./exportService");

    const ok = await importFromJSON(
      JSON.stringify({ data: { tasks: [{ id: "task-5" }] } }),
    );

    expect(ok).toBe(false);
    expect(syncFromDatabase).not.toHaveBeenCalled();
    expect(storage.size).toBe(0);
  });

  it("rejects non-array lists before writing anything", async () => {
    const { importFromJSON } = await import("./exportService");

    expect(await importFromJSON(JSON.stringify({ data: { tasks: {} } }))).toBe(
      false,
    );
    expect(command).not.toHaveBeenCalled();
  });

  describe("parseBackup", () => {
    const err = async (value: unknown) => {
      const { parseBackup } = await import("./exportService");
      const parsed = parseBackup(typeof value === "string" ? value : JSON.stringify(value));
      return "error" in parsed ? parsed.error : null;
    };

    it("accepts a valid backup and keeps only present lists", async () => {
      const { parseBackup } = await import("./exportService");
      const parsed = parseBackup(
        JSON.stringify({ version: "1.0", data: { tasks: [{ id: "t" }], notes: [{ date: "2026-01-01" }] } }),
      );
      expect(parsed).toEqual({ lists: { tasks: [{ id: "t" }], notes: [{ date: "2026-01-01" }] } });
    });

    it("rejects non-JSON, non-objects and missing data", async () => {
      expect(await err("not json")).toMatch(/JSON/);
      expect(await err([])).toMatch(/kein eTasks-Backup/);
      expect(await err({ version: "1.0" })).toMatch(/data/);
      expect(await err({ data: [] })).toMatch(/data/);
    });

    it("rejects unknown versions", async () => {
      expect(await err({ version: "2.0", data: { tasks: [{ id: "t" }] } })).toMatch(/Version/);
    });

    it("rejects a backup without any known list", async () => {
      expect(await err({ data: {} })).toMatch(/keine Daten/);
      expect(await err({ data: { other: [] } })).toMatch(/keine Daten/);
    });

    it("rejects non-array lists and non-object entries", async () => {
      expect(await err({ data: { tasks: {} } })).toMatch(/keine Liste/);
      expect(await err({ data: { tasks: ["x"] } })).toMatch(/kein Objekt/);
      expect(await err({ data: { tasks: [null] } })).toMatch(/kein Objekt/);
    });

    it("requires string keys per entity", async () => {
      expect(await err({ data: { tasks: [{ title: "x" }] } })).toMatch(/"id"/);
      expect(await err({ data: { tasks: [{ id: 5 }] } })).toMatch(/"id"/);
      expect(await err({ data: { notes: [{ id: "n" }] } })).toMatch(/"date"/);
      expect(await err({ data: { dayPlans: [{ id: "p" }] } })).toMatch(/"date"/);
      expect(await err({ data: { billingItems: [{ id: "b" }] } })).toMatch(/"projectId"/);
      expect(await err({ data: { billingItemTasks: [{ billingItemId: "b", taskId: "t" }] } })).toMatch(/"createdAt"/);
      expect(await err({ data: { weekPlans: [{ focusProjectIds: [] }] } })).toMatch(/"weekStart"/);
    });

    it("does not call the database for an invalid file", async () => {
      const { importFromJSON } = await import("./exportService");
      expect(await importFromJSON(JSON.stringify({ data: { tasks: [{ title: "x" }] } }))).toBe(false);
      expect(command).not.toHaveBeenCalled();
    });
  });

  it("summarises current and incoming counts", async () => {
    storage.set("etasks:tasks", JSON.stringify([{ id: "a" }, { id: "b" }]));
    const { importSummary } = await import("./exportService");
    expect(importSummary({ tasks: [{ id: "x" }], clients: [] })).toEqual([
      { name: "tasks", current: 2, incoming: 1 },
      { name: "clients", current: 0, incoming: 0 },
    ]);
  });

  it("writes the pre-import backup into the export folder and surfaces failures", async () => {
    command.mockResolvedValueOnce("/exports/vor.json");
    const { writePreImportBackup } = await import("./exportService");
    expect(await writePreImportBackup()).toBe("/exports/vor.json");
    expect(command).toHaveBeenCalledWith("export_to_file", {
      json: expect.any(String),
      filename: expect.stringMatching(/^etasks-vor-import-buro-muller-sohne-\d{4}-\d{2}-\d{2}\.json$/),
      directory: null,
    });

    command.mockRejectedValueOnce(new Error("Ordner nicht erreichbar"));
    await expect(writePreImportBackup()).rejects.toThrow("Ordner nicht erreichbar");
  });

  it("puts the workspace into snapshot and export file names", async () => {
    command.mockResolvedValue("/exports/x.json");
    const { saveDailySnapshot, exportToFile } = await import("./exportService");

    expect(await saveDailySnapshot()).toBe("/exports/x.json");
    await exportToFile();

    expect(command).toHaveBeenCalledWith("save_daily_snapshot", {
      json: expect.any(String),
      filename: expect.stringMatching(/^snapshot-buro-muller-sohne-\d{4}-\d{2}-\d{2}\.json$/),
      directory: null,
    });
    expect(command).toHaveBeenCalledWith("export_to_file", {
      json: expect.any(String),
      filename: expect.stringMatching(/^etasks-export-buro-muller-sohne-\d{4}-\d{2}-\d{2}\.json$/),
      directory: null,
    });
  });

  it("lists the backups of the active workspace and reads one by file name", async () => {
    command.mockResolvedValueOnce([{ filename: "snapshot-buro-muller-sohne-2026-11-13.json", date: "2026-11-13", sizeBytes: 10 }]);
    const { listSnapshots, readSnapshot } = await import("./exportService");
    expect(await listSnapshots()).toHaveLength(1);
    expect(command).toHaveBeenCalledWith("list_snapshots", { slug: "buro-muller-sohne", directory: null });

    command.mockResolvedValueOnce("{}");
    expect(await readSnapshot("snapshot-x-2026-11-13.json")).toBe("{}");
    expect(command).toHaveBeenCalledWith("read_snapshot", { filename: "snapshot-x-2026-11-13.json", directory: null });

    tauri = false;
    expect(await listSnapshots()).toEqual([]);
    tauri = true;
  });

  it("leaves bank and tax data out of the daily snapshot but not the manual export", async () => {
    command.mockResolvedValue("/exports/x.json");
    const { saveDailySnapshot, exportToFile } = await import("./exportService");

    await saveDailySnapshot();
    await exportToFile();

    const [daily, manual] = ["save_daily_snapshot", "export_to_file"].map((name) =>
      JSON.parse(command.mock.calls.find((c) => c[0] === name)![1].json),
    );
    for (const field of ["iban", "tax_id", "bank_name", "bic"]) {
      expect(daily.profile).not.toHaveProperty(field);
      expect(manual.profile).toHaveProperty(field);
    }
    expect(daily.profile.company).toBe("Test Co");
  });

  it("reports a daily snapshot failure and does not mark the day as done", async () => {
    command.mockRejectedValueOnce(new Error("Ordner nicht erreichbar"));
    const { saveDailySnapshot } = await import("./exportService");
    await expect(saveDailySnapshot()).rejects.toThrow("Ordner nicht erreichbar");
    expect(storage.has("etasks:exportMeta")).toBe(false);
  });
});
