import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ value: null as string | null }));
vi.mock("./metaStore", () => ({
  metaGet: vi.fn(async () => store.value),
  metaSet: vi.fn(async (_key: string, value: string) => {
    store.value = value;
  }),
}));

import {
  allocateInvoiceNumber,
  isInvoiceNumberTaken,
  nextFreeCounter,
} from "./invoiceNumber";

describe("invoiceNumber", () => {
  beforeEach(() => {
    store.value = null;
  });

  it("never goes below an existing number with the same prefix", () => {
    expect(nextFreeCounter("RE-", 1, ["RE-001", "RE-007", "XX-099"])).toBe(8);
    expect(nextFreeCounter("RE-", 12, ["RE-003"])).toBe(12);
    expect(nextFreeCounter("RE-", 1, [])).toBe(1);
  });

  it("detects duplicate numbers ignoring case and spaces", () => {
    expect(isInvoiceNumberTaken(" re-001", ["RE-001"])).toBe(true);
    expect(isInvoiceNumberTaken("RE-002", ["RE-001"])).toBe(false);
  });

  it("starts a workspace without invoices and counter at 1", async () => {
    expect(await allocateInvoiceNumber("RE-", 9, () => [])).toBe("RE-001");
    expect(store.value).toBe("2");
  });

  it("falls back to the profile counter for a workspace that already has invoices", async () => {
    expect(await allocateInvoiceNumber("RE-", 9, () => ["RE-002"])).toBe("RE-009");
  });

  it("hands out different numbers for parallel calls", async () => {
    const [a, b, c] = await Promise.all([
      allocateInvoiceNumber("RE-", 1, () => []),
      allocateInvoiceNumber("RE-", 1, () => []),
      allocateInvoiceNumber("RE-", 1, () => []),
    ]);
    expect([a, b, c]).toEqual(["RE-001", "RE-002", "RE-003"]);
  });

  it("skips numbers that exist even if the stored counter is lower", async () => {
    store.value = "2";
    expect(await allocateInvoiceNumber("RE-", 1, () => ["RE-001", "RE-005"])).toBe("RE-006");
  });
});
