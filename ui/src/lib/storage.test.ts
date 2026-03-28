import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn(() => Promise.resolve(null));

vi.mock("./platform", () => ({
  isTauriAvailable: () => true,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke,
}));

describe("storage entity key routing", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("does not mirror entity-backed keys into the KV table", async () => {
    const { storageSet, storageRemove, KEYS } = await import("./storage");

    storageSet(KEYS.tasks, [{ id: "task-1" }]);
    storageRemove(KEYS.tasks);

    expect(invoke).not.toHaveBeenCalledWith("db_set", expect.anything());
    expect(invoke).not.toHaveBeenCalledWith("db_remove", expect.anything());
  });

  it("still mirrors legacy keys into the KV table", async () => {
    const { storageSet, storageRemove, KEYS } = await import("./storage");

    storageSet(KEYS.exportMeta, { lastSnapshotDate: "2026-03-28" });
    storageRemove(KEYS.exportMeta);

    expect(invoke).toHaveBeenCalledWith("db_set", {
      key: KEYS.exportMeta,
      value: JSON.stringify({ lastSnapshotDate: "2026-03-28" }),
    });
    expect(invoke).toHaveBeenCalledWith("db_remove", {
      key: KEYS.exportMeta,
    });
  });
});
