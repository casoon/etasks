import { describe, expect, it } from "vitest";
import { createDefaultUserProfile } from "../stores/configStore";
import { normalizeProfileNumbers } from "./profileNumbers";

const base = () => createDefaultUserProfile();

describe("normalizeProfileNumbers", () => {
  it("keeps valid defaults", () => {
    const { profile, errors } = normalizeProfileNumbers(base());
    expect(errors).toEqual({});
    expect(profile.payment_days).toBe(14);
  });

  it("maps empty fields to the default or undefined", () => {
    const p = { ...base(), hourly_rate: null, payment_days: null, default_vat_rate: "" } as never;
    const { profile, errors } = normalizeProfileNumbers(p);
    expect(errors).toEqual({});
    expect(profile.hourly_rate).toBe(90);
    expect(profile.payment_days).toBeUndefined();
    expect(profile.default_vat_rate).toBeUndefined();
  });

  it("rejects decimals in integer fields and negatives", () => {
    const { errors } = normalizeProfileNumbers({
      ...base(),
      payment_days: 14.5,
      offer_validity_days: -1,
      hourly_rate: -5,
      break_interval_minutes: 999,
    });
    expect(Object.keys(errors).sort()).toEqual([
      "break_interval_minutes",
      "hourly_rate",
      "offer_validity_days",
      "payment_days",
    ]);
  });

  it("accepts decimal rates", () => {
    const { profile, errors } = normalizeProfileNumbers({ ...base(), hourly_rate: 87.5, default_vat_rate: 7.5 });
    expect(errors).toEqual({});
    expect(profile.hourly_rate).toBe(87.5);
  });
});
