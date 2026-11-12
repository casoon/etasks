import { describe, expect, it } from "vitest";
import type { BillingItem, TimeEntry, Termin } from "../domain/types";
import { calcInvoiceTotals } from "./invoiceMoney";
import {
  billableTermineForClient,
  billingItemToLineItem,
  termineToLineItem,
  minutesToQuarterHours,
  trackedTimeByProject,
  trackedTimeToLineItem,
} from "./invoiceImport";

const item = (patch: Partial<BillingItem>): BillingItem => ({
  id: "b1",
  projectId: "p1",
  title: "Webseite",
  billingType: "hourly",
  unitPriceCents: 9500,
  quantity: 3.5,
  createdAt: "",
  updatedAt: "",
  ...patch,
});

describe("billingItemToLineItem", () => {
  it("maps hourly items with price and quantity", () => {
    const li = billingItemToLineItem(item({}), 19);
    expect(li).toMatchObject({ name: "Webseite", unit: "Stunde", unitPrice: 95, quantity: 3.5, vatRate: 19 });
  });
  it("uses quantity 1 for fixed prices and defaults missing values", () => {
    expect(billingItemToLineItem(item({ billingType: "fixed", quantity: 4 }), 19)).toMatchObject({ unit: "Pauschal", quantity: 1 });
    expect(billingItemToLineItem(item({ billingType: "unit", quantity: null, unitPriceCents: null }), 7)).toMatchObject({ unit: "Einheit", quantity: 1, unitPrice: 0 });
  });
});

describe("minutesToQuarterHours", () => {
  it("rounds to quarter hours with a floor of 0.25", () => {
    expect(minutesToQuarterHours(0)).toBe(0);
    expect(minutesToQuarterHours(3)).toBe(0.25);
    expect(minutesToQuarterHours(52)).toBe(0.75);
    expect(minutesToQuarterHours(90)).toBe(1.5);
  });
});

describe("trackedTimeByProject", () => {
  const projects = [
    { id: "p1", name: "B-Projekt", clientId: "c1" },
    { id: "p2", name: "A-Projekt", clientId: "c1" },
    { id: "p3", name: "Fremd", clientId: "c2" },
  ];
  const e = (id: string, taskId: string, projectId: string, startAt: string, durationMinutes: number | null): TimeEntry => ({
    id, taskId, projectId, startAt, durationMinutes, isRunning: false, updatedAt: startAt,
  });
  const entries = [
    e("1", "t1", "p1", "2026-11-02T09:00:00", 60),
    e("2", "t1", "p1", "2026-11-03T09:00:00", 30),
    e("3", "t2", "p2", "2026-11-04T09:00:00", 45),
    e("4", "t3", "p3", "2026-11-04T09:00:00", 99),
    e("5", "t1", "p1", "2026-10-01T09:00:00", 500),
    e("6", "t1", "p1", "2026-11-05T09:00:00", null),
  ];
  it("sums per project of the client within the range, sorted by name", () => {
    const rows = trackedTimeByProject(entries, () => undefined, projects, "c1", "2026-11-01", "2026-11-30");
    expect(rows.map((r) => [r.projectName, r.minutes])).toEqual([["A-Projekt", 45], ["B-Projekt", 90]]);
    expect(rows[1].tasks).toEqual([{ taskId: "t1", minutes: 90 }]);
  });
  it("builds a line item with the hourly rate and exact sums", () => {
    const [, row] = trackedTimeByProject(entries, () => undefined, projects, "c1", "2026-11-01", "2026-11-30");
    const li = trackedTimeToLineItem(row, 87.5, 19, "2026-11-01", "2026-11-30");
    expect(li).toMatchObject({ unit: "Stunde", unitPrice: 87.5, quantity: 1.5 });
    expect(li.description).toBe("Erfasste Zeit 01.11.2026–30.11.2026");
    expect(calcInvoiceTotals([li]).nettoCents).toBe(13125);
  });
});

describe("billableTermineForClient", () => {
  const termin = (patch: Partial<Termin>): Termin => ({
    id: "m1", date: "2026-03-10", startTime: "10:00", durationMinutes: 60, type: "video", title: "T",
    billable: true, createdAt: "", updatedAt: "", projectId: "p1", ...patch,
  });
  const projects = [{ id: "p1", clientId: "c1" }, { id: "p2", clientId: "c2" }];

  it("sums billable appointments of the client in the range", () => {
    const termine = [
      termin({}),
      termin({ id: "m2", durationMinutes: 30, projectId: undefined, clientId: "c1" }),
      termin({ id: "m3", billable: false }),
      termin({ id: "m4", projectId: "p2" }),
      termin({ id: "m5", date: "2026-04-01" }),
    ];
    expect(billableTermineForClient(termine, projects, "c1", "2026-03-01", "2026-03-31")).toEqual({ count: 2, minutes: 90 });
  });

  it("builds a line item at the hourly rate", () => {
    expect(termineToLineItem({ count: 2, minutes: 90 }, 80, 19, "", "")).toMatchObject({
      name: "Termine", unit: "Stunde", unitPrice: 80, quantity: 1.5, vatRate: 19,
    });
  });
});
