import { describe, it, expect, vi } from "vitest";

// Adaptations from the brief's literal test code:
// 1. zero-`any`: the brief's literal `vi.fn(async () => 4)` already has no
//    `any` in it (no argument, so nothing to type) — kept as-is rather than
//    adding a redundant explicit-`any` parameter type, matching Tasks 6-8's
//    precedent of typed stubs only where a parameter is actually used.
// 2. `vi.hoisted`: the brief's literal `const count = vi.fn(...)` followed
//    by `vi.mock("@/lib/db", () => ({ ... count ... }))` throws
//    "Cannot access 'count' before initialization" — vi.mock factories run
//    at hoisted-import time (before the `const` line executes) whenever the
//    factory object literal references the variable directly (unlike
//    formulas.test.ts/materials.test.ts, where the mocked fn is only
//    referenced inside a nested arrow body evaluated lazily). `vi.hoisted`
//    is vitest's documented fix: it hoists the declaration itself above the
//    mock factory.
const { count } = vi.hoisted(() => ({ count: vi.fn(async () => 4) }));
vi.mock("@/lib/db", () => ({ prisma: { productionOrder: { count } } }));

import { generateOrderNumber } from "../generateOrderNumber";

describe("generateOrderNumber", () => {
  it("pads the consecutive to 3 digits under the current year prefix", async () => {
    const year = new Date().getFullYear();
    await expect(generateOrderNumber("tenant-1")).resolves.toBe(`OP-${year}-005`);
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant-1" }) }),
    );
  });
});
