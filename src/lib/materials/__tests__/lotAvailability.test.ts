import { describe, it, expect } from "vitest";
import { expiresSoon, isExpired, isLowStock, isUsableForWeighing } from "../lotAvailability";

const NOW = new Date("2026-11-22T15:00:00.000Z");

describe("lot availability", () => {
  it("treats a lot as usable through its expiry date and expired the day after", () => {
    expect(isExpired("2026-11-22T00:00:00.000Z", NOW)).toBe(false);
    expect(isExpired("2026-11-21T00:00:00.000Z", NOW)).toBe(true);
  });

  it("warns about lots that expire within 30 days, not expired ones", () => {
    expect(expiresSoon("2026-12-10T00:00:00.000Z", NOW)).toBe(true);
    expect(expiresSoon("2027-06-30T00:00:00.000Z", NOW)).toBe(false);
    expect(expiresSoon("2026-11-01T00:00:00.000Z", NOW)).toBe(false);
  });

  it("flags low stock under 10 % of what was received", () => {
    expect(isLowStock(4, 50)).toBe(true);
    expect(isLowStock(10, 50)).toBe(false);
    expect(isLowStock(0, 50)).toBe(false);
  });

  it("only offers released, unexpired lots with stock for weighing", () => {
    const base = { status: "liberado", expiryDate: "2027-01-01T00:00:00.000Z", quantityAvailable: 5 };
    expect(isUsableForWeighing(base, NOW)).toBe(true);
    expect(isUsableForWeighing({ ...base, status: "cuarentena" }, NOW)).toBe(false);
    expect(isUsableForWeighing({ ...base, expiryDate: "2026-10-01T00:00:00.000Z" }, NOW)).toBe(false);
    expect(isUsableForWeighing({ ...base, quantityAvailable: "0" }, NOW)).toBe(false);
  });
});
