import { describe, it, expect, vi } from "vitest";
import type { Prisma } from "@prisma/client";

// Zero-`any` precedent (Tasks 6-9): mocks are typed against the actual
// Prisma delegate call shapes rather than using `any`.
type CreateArgs = Prisma.BatchEventCreateArgs;

const create = vi.fn(async (args: CreateArgs) => ({ id: "ev1", ...args.data }));
const findUniqueOrThrow = vi.fn(async () => ({ id: "po1", status: "planificado" as const }));
// Review round 1 fix (Finding 2, TOCTOU guard): `advanceStageInternal` now
// pins its write with `updateMany({ where: { id, status: from } })` instead
// of a bare `update`, so the mock must provide `updateMany` returning a
// `{ count }` — `1` here simulates the common case where nothing else raced
// this transaction. The call args are asserted via `toHaveBeenCalledWith`
// below, not read inside the mock, so no parameter is declared here.
const updateMany = vi.fn(async (): Promise<{ count: number }> => ({ count: 1 }));

vi.mock("@/lib/db", () => ({
  withTenant: (_tenantId: string, fn: (tx: unknown) => unknown) =>
    fn({ batchEvent: { create }, productionOrder: { findUniqueOrThrow, updateMany } }),
}));

import { productionRouter } from "../production";

describe("production.recordWeighing", () => {
  it("writes a batch_events row and advances the order to 'pesado'", async () => {
    const caller = productionRouter.createCaller({
      user: { id: "u1", tenantId: "t1", role: "operario" },
      prisma: {} as never,
    });

    await caller.recordWeighing({
      productionOrderId: "550e8400-e29b-41d4-a716-446655440000",
      rawMaterialLotId: "550e8400-e29b-41d4-a716-446655440001",
      theoreticalQty: 12.5,
      actualQty: 12.48,
      clientEventId: "11111111-1111-4111-8111-111111111111",
      occurredAt: new Date().toISOString(),
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: "weighing" }) }),
    );
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "550e8400-e29b-41d4-a716-446655440000", status: "planificado" },
        data: { status: "pesado" },
      }),
    );
  });
});
