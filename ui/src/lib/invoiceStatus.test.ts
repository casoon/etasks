import { describe, expect, it } from "vitest";
import {
  displayStatus,
  dueLabel,
  filterInvoices,
  invoiceStep,
  matchesFilter,
  needsRevertConfirmation,
  openSummary,
  statusBlockedReason,
} from "./invoiceStatus";

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

const item = (unitPrice: number) => ({ unitPrice, quantity: 1, vatRate: 19 }) as never;

describe("displayStatus", () => {
  it("derives overdue only for sent invoices past their due date", () => {
    expect(displayStatus({ status: "sent", dueDate: "2026-11-08" }, "2026-11-12")).toBe("overdue");
    expect(displayStatus({ status: "sent", dueDate: "2026-11-12" }, "2026-11-12")).toBe("sent");
    expect(displayStatus({ status: "draft", dueDate: "2026-11-01" }, "2026-11-12")).toBe("draft");
    expect(displayStatus({ status: "paid", dueDate: "2026-11-01" }, "2026-11-12")).toBe("paid");
  });
});

describe("matchesFilter / filterInvoices", () => {
  const inv = (invoiceNumber: string, status: "draft" | "sent" | "paid", clientId: string, date: string) =>
    ({ invoiceNumber, status, clientId, date, createdAt: date }) as never;
  const list = [
    inv("RE-1", "paid", "a", "2026-10-01"),
    inv("RE-2", "sent", "b", "2026-11-02"),
    inv("RE-3", "draft", "a", "2026-11-12"),
  ];
  const name = (id: string) => (id === "a" ? "Praxis" : "Bäckerei");
  it("open means not paid, sent includes overdue", () => {
    expect(matchesFilter({ status: "draft" }, "open")).toBe(true);
    expect(matchesFilter({ status: "paid" }, "open")).toBe(false);
    expect(matchesFilter({ status: "sent" }, "sent")).toBe(true);
    expect(matchesFilter({ status: "paid" }, "all")).toBe(true);
  });
  it("filters by status and query, newest first", () => {
    expect(filterInvoices(list, name, "open", "").map((i: any) => i.invoiceNumber)).toEqual(["RE-3", "RE-2"]);
    expect(filterInvoices(list, name, "all", "bäck").map((i: any) => i.invoiceNumber)).toEqual(["RE-2"]);
    expect(filterInvoices(list, name, "all", "re-1").length).toBe(1);
  });
});

describe("openSummary", () => {
  it("sums sent invoices gross and counts overdue ones", () => {
    const s = openSummary(
      [
        { status: "sent", dueDate: "2026-11-08", lineItems: [item(100)] },
        { status: "sent", dueDate: "2026-11-20", lineItems: [item(200)] },
        { status: "draft", dueDate: "2026-11-01", lineItems: [item(999)] },
      ],
      "2026-11-12",
    );
    expect(s).toEqual({ openCents: 35700, overdueCount: 1 });
  });
});

describe("dueLabel", () => {
  it("describes the distance for sent invoices", () => {
    expect(dueLabel({ status: "sent", dueDate: "2026-11-16" }, "2026-11-12")).toEqual({ text: "16.11.2026 · in 4 Tagen", state: "plain" });
    expect(dueLabel({ status: "sent", dueDate: "2026-11-08" }, "2026-11-12")).toEqual({ text: "08.11.2026 · seit 4 Tagen", state: "overdue" });
    expect(dueLabel({ status: "sent", dueDate: "2026-11-11" }, "2026-11-12").text).toBe("11.11.2026 · seit 1 Tag");
    expect(dueLabel({ status: "sent", dueDate: "2026-11-13" }, "2026-11-12").text).toMatch(/morgen/);
    expect(dueLabel({ status: "draft", dueDate: "2026-11-16" }, "2026-11-12")).toEqual({ text: "16.11.2026", state: "plain" });
  });
});

describe("invoiceStep", () => {
  it("follows the flow check, pdf, send, paid", () => {
    expect(invoiceStep({ status: "draft" }, false)).toBe(1);
    expect(invoiceStep({ status: "draft" }, true)).toBe(2);
    expect(invoiceStep({ status: "draft", pdfPath: "/x.pdf" }, true)).toBe(3);
    expect(invoiceStep({ status: "sent" }, true)).toBe(4);
    expect(invoiceStep({ status: "paid" }, true)).toBe(5);
  });
});
