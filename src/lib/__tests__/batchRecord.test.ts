import { describe, it, expect, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { loadBatchRecord } from "../batchRecord";

const LOT_ID = "11111111-1111-4111-8111-111111111111";

function makeTx(order: unknown) {
  const orderFindFirst = vi.fn(async () => order);
  const tx = {
    productionOrder: { findFirst: orderFindFirst },
    organization: { findUnique: vi.fn(async () => ({ name: "CosmoLab", nit: "900", invimaRegistration: "INV-1" })) },
    rawMaterialLot: {
      findMany: vi.fn(async () => [
        { id: LOT_ID, supplierLotCode: "GLIC-118", rawMaterial: { code: "MP-002", name: "Glicerina", unit: "kg" } },
      ]),
    },
    user: {
      findMany: vi.fn(async () => [
        { id: "u-op", fullName: "Ana Operaria" },
        { id: "u-dt", fullName: "Diana Directora" },
      ]),
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, orderFindFirst };
}

const ORDER = {
  orderNumber: "OP-1",
  status: "liberado",
  formulaVersion: 1,
  plannedQuantity: 100,
  plannedStart: new Date("2026-11-22T13:00:00.000Z"),
  formula: {
    code: "F-001",
    name: "Crema",
    qcSpecifications: [{ parameter: "pH", minValue: 5.5, maxValue: 7, unit: null }],
  },
  finishedLot: { code: "OP-1" },
  signatures: [{ stage: "liberado", signedBy: "u-dt", meaningStatement: "Libero", signedAt: new Date("2026-11-22T19:00:00.000Z") }],
  qcResults: [{ parameter: "PH", measuredValue: 6.2, result: "pass", recordedBy: "u-dt" }],
  deviations: [],
  events: [
    {
      eventType: "weighing",
      actorUserId: "u-op",
      occurredAt: new Date("2026-11-22T14:00:00.000Z"),
      payload: { rawMaterialLotId: LOT_ID, theoreticalQty: 15, actualQty: 15.02 },
    },
  ],
};

describe("loadBatchRecord", () => {
  it("scopes the order to the tenant and resolves lots, specs and names", async () => {
    const { tx, orderFindFirst } = makeTx(ORDER);
    const record = await loadBatchRecord(tx, "t1", "o1", "u-dt");

    expect(orderFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "o1", tenantId: "t1" } }));
    expect(record.organization?.name).toBe("CosmoLab");
    expect(record.weighings?.[0]).toMatchObject({
      material: "MP-002 — Glicerina",
      supplierLot: "GLIC-118",
      actualQty: 15.02,
      unit: "kg",
      weighedBy: "Ana Operaria",
    });
    expect(record.signatures[0].signedBy).toBe("Diana Directora");
    expect(record.qcResults[0].specification).toBe("5.5 – 7");
    expect(record.events[0]).toMatchObject({ eventType: "Pesaje", actorUserId: "Ana Operaria" });
    expect(record.generatedBy).toBe("Diana Directora");
  });

  it("throws NOT_FOUND for an order outside the tenant", async () => {
    const { tx } = makeTx(null);
    await expect(loadBatchRecord(tx, "t1", "o1", "u-dt")).rejects.toBeInstanceOf(TRPCError);
  });
});
