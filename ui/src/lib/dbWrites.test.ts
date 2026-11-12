import { beforeEach, describe, expect, it, vi } from "vitest";

const command = vi.fn();

vi.mock("./platform", () => ({ isTauriAvailable: () => true }));
vi.mock("@casoon/origin-client", () => ({ command }));

describe("dbWrites", () => {
  beforeEach(() => {
    command.mockReset();
    vi.resetModules();
  });

  it("waits for in-flight writes before the workspace switch runs", async () => {
    const { dbWrite, runWorkspaceSwitch } = await import("./dbWrites");
    const order: string[] = [];
    let finishWrite: () => void = () => {};
    command.mockImplementation(
      () => new Promise<void>((resolve) => (finishWrite = () => { order.push("write done"); resolve(); })),
    );

    void dbWrite("db_set", { key: "a" });
    const switched = runWorkspaceSwitch(async () => { order.push("switch"); });
    await Promise.resolve();
    expect(order).toEqual([]);
    finishWrite();
    await switched;
    expect(order).toEqual(["write done", "switch"]);
  });

  it("drops writes issued while the switch is running and resumes afterwards", async () => {
    const { dbWrite, runWorkspaceSwitch } = await import("./dbWrites");
    command.mockResolvedValue(null);

    await runWorkspaceSwitch(async () => {
      await dbWrite("upsert_task", { task: { id: "from-old-workspace" } });
    });
    expect(command).not.toHaveBeenCalled();

    await dbWrite("upsert_task", { task: { id: "after" } });
    expect(command).toHaveBeenCalledTimes(1);
  });

  it("lets the switch proceed when a pending write fails", async () => {
    const { dbWrite, runWorkspaceSwitch } = await import("./dbWrites");
    command.mockRejectedValue(new Error("locked"));
    const write = dbWrite("db_set", {});
    write.catch(() => {});
    await expect(runWorkspaceSwitch(async () => "ok")).resolves.toBe("ok");
  });
});
