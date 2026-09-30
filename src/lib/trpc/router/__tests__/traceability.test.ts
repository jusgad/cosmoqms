import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma } from "@prisma/client";

// Zero-`any` precedent (Tasks 6-15): mocks are typed against the actual
// Prisma delegate call shapes rather than using `any`. The brief's literal
// Step 1 test (task-16-brief.md) used `vi.fn(async () => [...])` with
// `(e: any) => ...` filters and called `byRawMaterialLot`/`byFinishedLot`
// with a raw UUID (`rawMaterialLotId: "lot1"`). Adapted here for two reasons:
//
// 1. Zero-`any` constraint: filters/maps below are typed against `BatchEvent`
//    (Prisma's generated type) instead of `(e: any) => ...`.
// 2. Real-world gap (see traceability.ts and task-16-report.md): a calidad/
//    director_tecnico user searching for traceability types a human-readable
//    LOT CODE, never a UUID they'd never know. The router resolves a typed
//    code to the corresponding lot's id via an internal lookup (matching the
//    codebase's existing "search by human code" precedent in
//    WeighingForm.tsx/LotManualSearch.tsx) before running the genealogy
//    query, so both procedures take a `*Code: string` input, not a UUID.
type BatchEventWhereInput = Prisma.BatchEventWhereInput;
type WeighingEvent = { id: string; productionOrderId: string; payload: Prisma.JsonValue };

const batchEvents: WeighingEvent[] = [
  { id: "ev1", productionOrderId: "po1", payload: { rawMaterialLotId: "lot1" } },
];

const findMany = vi.fn(async (args: { where: BatchEventWhereInput }): Promise<WeighingEvent[]> => {
  void args;
  return batchEvents;
});
const rawMaterialLotFindFirstOrThrow = vi.fn(async () => ({ id: "lot1", supplierLotCode: "SUP-001" }));
const finishedProductLotFindFirstOrThrow = vi.fn(async () => ({
  id: "flot1",
  code: "PT-0001",
  productionOrderId: "po1",
}));

vi.mock("@/lib/db", () => ({
  withTenant: (_tenantId: string, fn: (tx: unknown) => unknown) =>
    fn({
      batchEvent: { findMany },
      rawMaterialLot: { findFirstOrThrow: rawMaterialLotFindFirstOrThrow },
      finishedProductLot: { findFirstOrThrow: finishedProductLotFindFirstOrThrow },
    }),
}));

import { traceabilityRouter } from "../traceability";

const caller = (role: "calidad" | "director_tecnico") =>
  traceabilityRouter.createCaller({ user: { id: "u1", tenantId: "t1", role }, prisma: {} as never });

describe("traceability.byRawMaterialLot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rawMaterialLotFindFirstOrThrow.mockResolvedValue({ id: "lot1", supplierLotCode: "SUP-001" });
    findMany.mockResolvedValue(batchEvents);
  });

  it("resolves the lot code to an id, then returns the distinct production orders that consumed it", async () => {
    const result = await caller("calidad").byRawMaterialLot({ rawMaterialLotCode: "SUP-001" });

    expect(rawMaterialLotFindFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "t1" }),
      }),
    );
    expect(findMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", eventType: "weighing" },
    });
    expect(result).toEqual(["po1"]);
  });

  it("dedupes production orders across multiple weighing events for the same lot", async () => {
    findMany.mockResolvedValue([
      { id: "ev1", productionOrderId: "po1", payload: { rawMaterialLotId: "lot1" } },
      { id: "ev2", productionOrderId: "po1", payload: { rawMaterialLotId: "lot1" } },
      { id: "ev3", productionOrderId: "po2", payload: { rawMaterialLotId: "other-lot" } },
    ]);

    const result = await caller("director_tecnico").byRawMaterialLot({ rawMaterialLotCode: "SUP-001" });

    expect(result).toEqual(["po1"]);
  });
});

describe("traceability.byFinishedLot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    finishedProductLotFindFirstOrThrow.mockResolvedValue({
      id: "flot1",
      code: "PT-0001",
      productionOrderId: "po1",
    });
    findMany.mockResolvedValue(batchEvents);
  });

  it("resolves the finished-lot code, then returns the raw material lots consumed in its production order", async () => {
    const result = await caller("calidad").byFinishedLot({ finishedProductLotCode: "PT-0001" });

    expect(finishedProductLotFindFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "t1", code: "PT-0001" }),
      }),
    );
    expect(findMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", productionOrderId: "po1", eventType: "weighing" },
    });
    expect(result).toEqual(["lot1"]);
  });

  it("filters out weighing events with no rawMaterialLotId in the payload", async () => {
    findMany.mockResolvedValue([
      { id: "ev1", productionOrderId: "po1", payload: { rawMaterialLotId: "lot1" } },
      { id: "ev2", productionOrderId: "po1", payload: {} },
    ]);

    const result = await caller("calidad").byFinishedLot({ finishedProductLotCode: "PT-0001" });

    expect(result).toEqual(["lot1"]);
  });
});
