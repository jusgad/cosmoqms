import { describe, it, expect, vi } from "vitest";
import type { FormulaIngredient, MasterFormula } from "@prisma/client";

type FormulaWithIngredients = MasterFormula & { ingredients: FormulaIngredient[] };

const findUniqueOrThrow = vi.fn(
  async (): Promise<Partial<FormulaWithIngredients>> => ({
    id: "f1",
    ingredients: [
      { percentage: 60 } as unknown as FormulaIngredient,
      { percentage: 39 } as unknown as FormulaIngredient,
    ],
  }),
);
const update = vi.fn();

vi.mock("@/lib/db", () => ({
  withTenant: (_tenantId: string, fn: (tx: unknown) => unknown) =>
    fn({ masterFormula: { findUniqueOrThrow, update } }),
}));

import { formulasRouter } from "../formulas";
import { TRPCError } from "@trpc/server";

describe("formulas.activate", () => {
  it("rejects activation when ingredients don't sum to ~100%", async () => {
    // NOTE: deviating from the brief's literal `role: "jefe_planta"` here.
    // `activate` is gated to `calidad` only (brief Step 7), so a
    // `jefe_planta` caller would be rejected with FORBIDDEN before ever
    // reaching the tolerance check — the assertion below would pass
    // trivially without exercising the 100% rule at all. Using `calidad`
    // (the role actually allowed to activate) makes the test verify what it
    // claims to verify: that BAD_REQUEST comes from the composition check.
    const caller = formulasRouter.createCaller({
      user: { id: "u1", tenantId: "t1", role: "calidad" },
      prisma: {} as never,
    });
    const error = await caller.activate({ id: "f1" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TRPCError);
    expect((error as TRPCError).code).toBe("BAD_REQUEST");
    expect(update).not.toHaveBeenCalled();
  });
});
