import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./platform", () => ({ isTauriAvailable: () => false }));

import { metaDelete, metaGet, metaSet } from "./metaStore";

describe("metaStore in browser mode", () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    });
  });

  it("persists values in localStorage", async () => {
    expect(await metaGet("invoice.counter")).toBeNull();
    await metaSet("invoice.counter", "7");
    expect(await metaGet("invoice.counter")).toBe("7");
    await metaDelete("invoice.counter");
    expect(await metaGet("invoice.counter")).toBeNull();
  });

  it("does not throw when storage is unavailable", async () => {
    vi.stubGlobal("localStorage", undefined);
    await expect(metaSet("a", "b")).resolves.toBeUndefined();
    expect(await metaGet("a")).toBeNull();
  });
});
