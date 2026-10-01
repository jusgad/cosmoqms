import { describe, it, expect, vi } from "vitest";

// Final review (Important 7c): all weighing validation/stock/stage logic now
// lives in `applyWeighing` (covered in lib/production/__tests__/weighing.test.ts).
// This test only verifies the tRPC procedure wires the caller's tenant/actor
// into it and returns the tenant-scoped order.
const { applyWeighing } = vi.hoisted(() => ({ applyWeighing: vi.fn(async () => ({ id: "ev1" })) }));
vi.mock("@/lib/production/weighing", () => ({ applyWeighing, assertAllIngredientsWeighed: vi.fn() }));

const findFirst = vi.fn(async () => ({ id: "po1", status: "pesado" as const }));
vi.mock("@/lib/db", () => ({
  withTenant: (_tenantId: string, _actorUserId: string, fn: (tx: unknown) => unknown) =>
    fn({ productionOrder: { findFirst } }),
}));

import { productionRouter } from "../production";

describe("production.recordWeighing", () => {
  it("delegates to applyWeighing with the caller's tenant/actor and returns the tenant-scoped order", async () => {
    const caller = productionRouter.createCaller({
      user: { id: "u1", tenantId: "t1", role: "operario" },
      prisma: {} as never,
    });

    const result = await caller.recordWeighing({
      productionOrderId: "550e8400-e29b-41d4-a716-446655440000",
      rawMaterialLotId: "550e8400-e29b-41d4-a716-446655440001",
      theoreticalQty: 12.5,
      actualQty: 12.48,
      clientEventId: "11111111-1111-4111-8111-111111111111",
      occurredAt: new Date().toISOString(),
    });

    expect(applyWeighing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: "t1",
        actorUserId: "u1",
        productionOrderId: "550e8400-e29b-41d4-a716-446655440000",
        rawMaterialLotId: "550e8400-e29b-41d4-a716-446655440001",
        actualQty: 12.48,
      }),
    );
    // The client's `theoreticalQty` is never forwarded — the server recomputes it.
    expect(applyWeighing).toHaveBeenCalledWith(expect.anything(), expect.not.objectContaining({ theoreticalQty: 12.5 }));
    expect(findFirst).toHaveBeenCalledWith({ where: { id: "550e8400-e29b-41d4-a716-446655440000", tenantId: "t1" } });
    expect(result.status).toBe("pesado");
  });

  it("rejects a role that cannot capture weighings", async () => {
    const caller = productionRouter.createCaller({
      user: { id: "u1", tenantId: "t1", role: "calidad" },
      prisma: {} as never,
    });
    await expect(
      caller.recordWeighing({
        productionOrderId: "550e8400-e29b-41d4-a716-446655440000",
        rawMaterialLotId: "550e8400-e29b-41d4-a716-446655440001",
        theoreticalQty: 12.5,
        actualQty: 12.48,
        clientEventId: "11111111-1111-4111-8111-111111111111",
        occurredAt: new Date().toISOString(),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
