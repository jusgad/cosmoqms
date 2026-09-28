import { describe, it, expect } from "vitest";
import { sumPercentages, isWithinTolerance } from "../validateComposition";

describe("sumPercentages", () => {
  it("sums ingredient percentages", () => {
    expect(sumPercentages([{ percentage: 60 }, { percentage: 40 }])).toBe(100);
  });
});

describe("isWithinTolerance", () => {
  it("accepts 100.3% within the default 0.5% tolerance", () => {
    expect(isWithinTolerance(100.3)).toBe(true);
  });
  it("rejects 99.2% outside the default 0.5% tolerance", () => {
    expect(isWithinTolerance(99.2)).toBe(false);
  });
  it("respects a custom tolerance", () => {
    expect(isWithinTolerance(101, 1.5)).toBe(true);
  });
});
