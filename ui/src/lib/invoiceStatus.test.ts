import { describe, expect, it } from "vitest";
import { needsRevertConfirmation, statusBlockedReason } from "./invoiceStatus";

const line = {} as never;

describe("statusBlockedReason", () => {
  it("blocks sent and paid without client or items", () => {
    expect(statusBlockedReason({ clientId: "", lineItems: [line] }, "paid")).toMatch(/Kunden/);
    expect(statusBlockedReason({ clientId: "c", lineItems: [] }, "sent")).toMatch(/Position/);
    expect(statusBlockedReason({ clientId: "", lineItems: [] }, "paid")).not.toBe("");
  });
  it("allows complete invoices and always draft", () => {
    expect(statusBlockedReason({ clientId: "c", lineItems: [line] }, "paid")).toBe("");
    expect(statusBlockedReason({ clientId: "", lineItems: [] }, "draft")).toBe("");
  });
});

describe("needsRevertConfirmation", () => {
  it("asks only when leaving sent/paid for draft", () => {
    expect(needsRevertConfirmation("paid", "draft")).toBe(true);
    expect(needsRevertConfirmation("sent", "draft")).toBe(true);
    expect(needsRevertConfirmation("paid", "sent")).toBe(false);
    expect(needsRevertConfirmation("draft", "sent")).toBe(false);
  });
});
