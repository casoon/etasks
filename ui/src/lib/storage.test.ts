import { beforeEach, describe, expect, it, vi } from "vitest";

const command = vi.fn(() => Promise.resolve(null));

vi.mock("./platform", () => ({
  isTauriAvailable: () => true,
}));

vi.mock("@casoon/origin-client", () => ({
  command,
}));

describe("storage entity key routing", () => {
  beforeEach(() => {
    command.mockReset();
  });

  it("does not mirror entity-backed keys into the KV table", async () => {
    const { storageSet, storageRemove, KEYS } = await import("./storage");

    storageSet(KEYS.tasks, [{ id: "task-1" }]);
    storageRemove(KEYS.tasks);

    expect(command).not.toHaveBeenCalledWith("db_set", expect.anything());
    expect(command).not.toHaveBeenCalledWith("db_remove", expect.anything());
  });

  it("still mirrors legacy keys into the KV table", async () => {
    const { storageSet, storageRemove, KEYS } = await import("./storage");

    storageSet(KEYS.exportMeta, { lastSnapshotDate: "2026-03-28" });
    storageRemove(KEYS.exportMeta);

    expect(command).toHaveBeenCalledWith("db_set", {
      key: KEYS.exportMeta,
      value: JSON.stringify({ lastSnapshotDate: "2026-03-28" }),
    });
    expect(command).toHaveBeenCalledWith("db_remove", {
      key: KEYS.exportMeta,
    });
  });
});

describe("syncFromDatabase", () => {
  const store = new Map<string, string>();
  const toast = vi.fn();

  beforeEach(() => {
    store.clear();
    command.mockReset();
    toast.mockReset();
    vi.resetModules();
    vi.doMock("./logger", () => ({
      logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    }));
    vi.doMock("../stores/toastStore", () => ({ toast }));
    vi.stubGlobal("window", { localStorage: {} });
    vi.stubGlobal("localStorage", {
      get length() {
        return store.size;
      },
      key: (i: number) => [...store.keys()][i] ?? null,
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });

  function mockDb(failing: string[] = [], kv: Record<string, string> = {}) {
    command.mockImplementation(((cmd: string, args?: { key: string }) => {
      if (failing.includes(cmd)) return Promise.reject(new Error("boom"));
      if (cmd === "db_all_keys") return Promise.resolve(Object.keys(kv));
      if (cmd === "db_get") return Promise.resolve(kv[args!.key] ?? null);
      return Promise.resolve([]);
    }) as never);
  }

  it("drops KV data of the previous workspace but keeps UI prefs", async () => {
    store.set("etasks:termine", '[{"id":"a"}]');
    store.set("etasks:weekPlans", "[1]");
    store.set("etasks:exportMeta", '{"lastSnapshotDate":"2026-01-01"}');
    store.set("etasks:kanban:collapsed:x", "1");
    mockDb([], { "etasks:termine": '[{"id":"b"}]' });
    const { syncFromDatabase } = await import("./storage");

    await syncFromDatabase();

    expect(store.get("etasks:termine")).toBe('[{"id":"b"}]');
    expect(store.has("etasks:weekPlans")).toBe(false);
    expect(store.has("etasks:exportMeta")).toBe(false);
    expect(store.get("etasks:kanban:collapsed:x")).toBe("1");
    expect(store.get("etasks:tasks")).toBe("[]");
    expect(toast).not.toHaveBeenCalled();
  });

  it("surfaces a failing list command and does not keep old rows", async () => {
    store.set("etasks:tasks", '[{"id":"old"}]');
    mockDb(["list_tasks"]);
    const { syncFromDatabase } = await import("./storage");

    await syncFromDatabase();

    expect(store.has("etasks:tasks")).toBe(false);
    expect(store.get("etasks:projects")).toBe("[]");
    expect(toast).toHaveBeenCalledWith(expect.any(String), "error", 6000);
  });
});
