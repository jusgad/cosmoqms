import { describe, it, expect, vi } from "vitest";
import type { MasterFormula } from "@prisma/client";

const findUniqueOrThrow = vi.fn(
  async (): Promise<Partial<MasterFormula>> => ({
    id: "f1",
    version: 2,
    status: "draft",
  }),
);
const create = vi.fn();

vi.mock("@/lib/db", () => ({
  withTenant: (_tenantId: string, _actorUserId: string, fn: (tx: unknown) => unknown) =>
    fn({ masterFormula: { findUniqueOrThrow }, productionOrder: { create } }),
}));

import { productionRouter } from "../production";
import { TRPCError } from "@trpc/server";

describe("production.create", () => {
  it("rejects creating an order from a non-active formula", async () => {
    // Non-negotiable (CLAUDE.md): a formula must be `status === "active"` to
    // be used in a new production order. This must be enforced server-side,
    // not just hidden behind the client's `formulas.listActive` filter.
    const caller = productionRouter.createCaller({
      user: { id: "u1", tenantId: "t1", role: "jefe_planta" },
      prisma: {} as never,
    });
    const error = await caller
      .create({ formulaId: "550e8400-e29b-41d4-a716-446655440000", plannedQuantity: 10 })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TRPCError);
    expect((error as TRPCError).code).toBe("BAD_REQUEST");
    expect(create).not.toHaveBeenCalled();
  });
});
