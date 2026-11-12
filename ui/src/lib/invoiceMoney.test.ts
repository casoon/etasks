import { describe, expect, it } from "vitest";
import {
  calcInvoiceTotals,
  isValidQuantity,
  isValidUnitPrice,
  isValidVatRate,
  lineTotalCents,
} from "./invoiceMoney";

const item = (unitPrice: number, quantity: number, vatRate = 19) => ({
  unitPrice,
  quantity,
  vatRate,
});

describe("invoiceMoney", () => {
  it("rounds each line once and sums the rounded lines", () => {
    const totals = calcInvoiceTotals([item(95.5, 0.25), item(95.5, 0.25)]);
    expect(lineTotalCents(95.5, 0.25)).toBe(2388);
    expect(totals.nettoCents).toBe(4776);
    expect(totals.vatEntries).toEqual([{ rate: 19, baseCents: 4776, amountCents: 907 }]);
    expect(totals.totalCents).toBe(4776 + 907);
  });

  it("groups VAT by rate with that rate's own base", () => {
    const totals = calcInvoiceTotals([item(100, 1, 19), item(50, 2, 7), item(10, 1, 19)]);
    expect(totals.nettoCents).toBe(21000);
    expect(totals.vatEntries).toEqual([
      { rate: 19, baseCents: 11000, amountCents: 2090 },
      { rate: 7, baseCents: 10000, amountCents: 700 },
    ]);
    expect(totals.vatCents).toBe(2790);
    expect(totals.totalCents).toBe(23790);
  });

  it("handles floating point prices without drifting", () => {
    expect(lineTotalCents(0.1, 3)).toBe(30);
    expect(lineTotalCents(19.99, 3)).toBe(5997);
    expect(lineTotalCents(1.005, 1)).toBe(101);
  });

  it("returns zero for no items", () => {
    expect(calcInvoiceTotals([])).toEqual({
      nettoCents: 0,
      vatEntries: [],
      vatCents: 0,
      totalCents: 0,
    });
  });

  it("validates price, VAT rate and quantity ranges", () => {
    expect(isValidUnitPrice(0)).toBe(true);
    expect(isValidUnitPrice(-50)).toBe(false);
    expect(isValidUnitPrice(NaN)).toBe(false);
    expect(isValidVatRate(0)).toBe(true);
    expect(isValidVatRate(100)).toBe(true);
    expect(isValidVatRate(-1)).toBe(false);
    expect(isValidVatRate(101)).toBe(false);
    expect(isValidQuantity(0.25)).toBe(true);
    expect(isValidQuantity(0)).toBe(false);
    expect(isValidQuantity(-1)).toBe(false);
    expect(isValidQuantity(NaN)).toBe(false);
  });
});
