import { describe, it, expect } from "vitest";
import { evaluateAgainstSpec, normalizeParameter } from "../evaluateSpec";

describe("evaluateAgainstSpec", () => {
  const range = { minValue: 5.5, maxValue: 7 };

  it.each([
    [5.5, "pass"],
    [6.2, "pass"],
    [7, "pass"],
    [5.49, "fail"],
    [7.01, "fail"],
  ] as const)("measures %s as %s against 5.5–7 (inclusive)", (value, expected) => {
    expect(evaluateAgainstSpec(value, range)).toBe(expected);
  });

  it("only checks the bound that exists", () => {
    expect(evaluateAgainstSpec(1_000_000, { minValue: 10, maxValue: null })).toBe("pass");
    expect(evaluateAgainstSpec(-5, { minValue: null, maxValue: 0 })).toBe("pass");
    expect(evaluateAgainstSpec(9, { minValue: 10, maxValue: null })).toBe("fail");
  });
});

describe("normalizeParameter", () => {
  it("ignores case and surrounding whitespace", () => {
    expect(normalizeParameter("  pH ")).toBe(normalizeParameter("PH"));
  });
});
