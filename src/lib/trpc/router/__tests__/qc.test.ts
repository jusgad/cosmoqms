import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

// Zero-`any` precedent (Tasks 6-11): mocks are typed against the actual
// Prisma delegate call shapes rather than using `any`. The brief's literal
// Step 1 test (task-12-brief.md) used `vi.fn(async (a: any) => ...)` — adapted
// here to typed args per the zero-`any` constraint (no ESLint exemption for
// test files).
type QcResultCreateArgs = Prisma.QcResultCreateArgs;
type BatchSignatureCreateArgs = Prisma.BatchSignatureCreateArgs;
type BatchEventCreateArgs = Prisma.BatchEventCreateArgs;
type FinishedProductLotCreateArgs = Prisma.FinishedProductLotCreateArgs;

const qcResultCreate = vi.fn(async (args: QcResultCreateArgs) => ({ id: "qc1", ...args.data }));
// Module-level toggles so individual tests can simulate the exact QC/deviation
// state the "release" guard reads, without re-mocking `@/lib/db` per test.
let qcFindManyResult: { result: string }[] = [];
let deviationFindManyResult: { status: string }[] = [];
const qcResultFindMany = vi.fn(async (): Promise<{ result: string }[]> => qcFindManyResult);
const deviationFindMany = vi.fn(async (): Promise<{ status: string }[]> => deviationFindManyResult);
const batchSignatureCreate = vi.fn(async (args: BatchSignatureCreateArgs) => ({ id: "sig1", ...args.data }));
const batchEventCreate = vi.fn(async (args: BatchEventCreateArgs) => ({ id: "ev1", ...args.data }));
const finishedProductLotCreate = vi.fn(async (args: FinishedProductLotCreateArgs) => ({ id: "lot1", ...args.data }));
const findUniqueOrThrow = vi.fn(async () => ({ id: "po1", orderNumber: "OP-0001", status: "calidad" as const }));
const updateMany = vi.fn(async (): Promise<{ count: number }> => ({ count: 1 }));

vi.mock("@/lib/db", () => ({
  withTenant: (_tenantId: string, _actorUserId: string, fn: (tx: unknown) => unknown) =>
    fn({
      qcResult: { create: qcResultCreate, findMany: qcResultFindMany },
      deviation: { findMany: deviationFindMany },
      batchSignature: { create: batchSignatureCreate },
      batchEvent: { create: batchEventCreate },
      finishedProductLot: { create: finishedProductLotCreate },
      productionOrder: { findUniqueOrThrow, updateMany },
    }),
}));

// Same pattern as production.sign.test.ts (Task 11): a module-level toggle
// lets tests simulate a session that has NOT actually completed step-up,
// even while the client claims `reauthVerified: true`.
let hasReverification = true;
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ has: (): boolean => hasReverification }),
}));

import { qcRouter } from "../qc";

const caller = (role: "calidad" | "director_tecnico") =>
  qcRouter.createCaller({ user: { id: "u1", tenantId: "t1", role }, prisma: {} as never });

describe("qc.recordResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasReverification = true;
    qcFindManyResult = [];
    deviationFindManyResult = [];
  });

  it("records a fail result (brief's literal Step 1 scenario)", async () => {
    const result = await caller("calidad").recordResult({
      productionOrderId: "550e8400-e29b-41d4-a716-446655440000",
      parameter: "pH",
      measuredValue: 8.9,
      result: "fail",
    });
    expect(result.result).toBe("fail");
    expect(qcResultCreate).toHaveBeenCalled();
  });
});

describe("qc.release", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasReverification = true;
    qcFindManyResult = [];
    deviationFindManyResult = [];
  });

  const validInput = {
    productionOrderId: "550e8400-e29b-41d4-a716-446655440000",
    meaningStatement: "Reviso los resultados de calidad y libero este lote",
    reauthVerified: true as const,
  };

  it("blocks release when a fail QC result exists", async () => {
    qcFindManyResult = [{ result: "fail" }];

    const error = await caller("director_tecnico")
      .release(validInput)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TRPCError);
    expect(updateMany).not.toHaveBeenCalled();
    expect(finishedProductLotCreate).not.toHaveBeenCalled();
  });

  it("blocks release when an open deviation exists", async () => {
    deviationFindManyResult = [{ status: "abierta" }];

    const error = await caller("director_tecnico")
      .release(validInput)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TRPCError);
    expect(updateMany).not.toHaveBeenCalled();
    expect(finishedProductLotCreate).not.toHaveBeenCalled();
  });

  // Gap 2 regression test: the client-sent `reauthVerified: true` alone must
  // never be trusted — Clerk's own server-side session check must also agree
  // step-up was actually completed (same pattern as production.sign.test.ts's
  // "Finding 1" regression test).
  it("rejects release when the server-side reverification check fails, even though the client claims reauthVerified: true", async () => {
    hasReverification = false;

    const error = await caller("director_tecnico")
      .release(validInput)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TRPCError);
    expect((error as TRPCError).code).toBe("UNAUTHORIZED");
    expect(batchSignatureCreate).not.toHaveBeenCalled();
    expect(finishedProductLotCreate).not.toHaveBeenCalled();
  });

  it("rejects an empty meaningStatement even if reauthVerified is true", async () => {
    await expect(
      caller("director_tecnico").release({
        productionOrderId: validInput.productionOrderId,
        meaningStatement: "",
        reauthVerified: true,
      }),
    ).rejects.toThrow();
  });

  // Gap 1 + happy path: no fail results, no open deviations -> advances the
  // order, writes the final signature, and creates the FinishedProductLot row
  // the dashboard's "lotes liberados este mes" KPI (Task 5) depends on.
  it("advances the order, signs, and creates a FinishedProductLot when QC is clean", async () => {
    const result = await caller("director_tecnico").release(validInput);

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: validInput.productionOrderId, status: "calidad" },
        data: { status: "liberado" },
      }),
    );
    expect(batchSignatureCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productionOrderId: validInput.productionOrderId,
          stage: "liberado",
          signedBy: "u1",
          reauthVerified: true,
          meaningStatement: validInput.meaningStatement,
        }),
      }),
    );
    expect(finishedProductLotCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "t1",
          productionOrderId: validInput.productionOrderId,
          code: "OP-0001",
          releasedBy: "u1",
        }),
      }),
    );
    expect(result.lot.code).toBe("OP-0001");
  });
});
