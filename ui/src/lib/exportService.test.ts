import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();

vi.mock("./platform", () => ({
  isTauriAvailable: () => true,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
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
  },
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
}));

vi.mock("../stores/serviceStore", () => ({
  $services: { get: () => [{ id: "service-1" }] },
}));

vi.mock("../stores/invoiceStore", () => ({
  $invoices: { get: () => [{ id: "invoice-1" }] },
}));

vi.mock("../stores/configStore", () => ({
  $appConfig: {
    get: () => ({ profile: { company: "Test Co" } }),
  },
  saveAppConfig: vi.fn(),
}));

vi.mock("./metaStore", () => ({
  metaAll: async () => [
    { key: "tenant.name", value: "Test Co", valueType: "string" },
  ],
}));

describe("exportService", () => {
  beforeEach(() => {
    storage.clear();
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
    });
    expect(snapshot.profile).toEqual({ company: "Test Co" });
    expect(snapshot.tenantMeta).toEqual([
      { key: "tenant.name", value: "Test Co", valueType: "string" },
    ]);
  });

  it("imports all persisted entities from JSON", async () => {
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
          billingItems: [{ id: "billing-2" }],
          billingItemTasks: [{ billingItemId: "billing-2", taskId: "task-2" }],
          dayPlans: [{ id: "plan-2", date: "2026-03-29" }],
          invoices: [{ id: "invoice-2" }],
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
      { id: "billing-2" },
    ]);
    expect(
      JSON.parse(storage.get("etasks:billingItemTasks") ?? "null"),
    ).toEqual([{ billingItemId: "billing-2", taskId: "task-2" }]);
    expect(JSON.parse(storage.get("etasks:dayPlans") ?? "null")).toEqual([
      { id: "plan-2", date: "2026-03-29" },
    ]);
    expect(JSON.parse(storage.get("etasks:invoices") ?? "null")).toEqual([
      { id: "invoice-2" },
    ]);
  });
});
