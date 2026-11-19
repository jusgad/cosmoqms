import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

// Zero-`any` precedent (Tasks 6-11): mocks are typed against the actual
// Prisma delegate call shapes rather than using `any`.
type QcResultCreateArgs = Prisma.QcResultCreateArgs;
type BatchSignatureCreateArgs = Prisma.BatchSignatureCreateArgs;
type BatchEventCreateArgs = Prisma.BatchEventCreateArgs;
type FinishedProductLotCreateArgs = Prisma.FinishedProductLotCreateArgs;
type MockOrder = { id: string; orderNumber: string; formulaId: string; status: string };

// Module-level toggles so individual tests can simulate the exact
// order/QC/spec/deviation state the guards read.
let order: MockOrder | null;
let qcResults: { parameter: string; result: string }[];
type MockSpec = { parameter: string; minValue: number | null; maxValue: number | null; unit: string | null };
let specs: MockSpec[];
let deviations: { status: string }[];

const spec = (parameter: string, minValue: number | null = null, maxValue: number | null = null): MockSpec => ({
  parameter,
  minValue,
  maxValue,
  unit: null,
});

type UserFindManyArgs = Prisma.UserFindManyArgs;
type NotificationCreateArgs = Prisma.NotificationCreateManyAndReturnArgs;
const userFindMany = vi.fn(async (args: UserFindManyArgs) => {
  void args;
  return [{ id: "u-jefe", email: "jefe@lab.co" }];
});
const notificationCreateManyAndReturn = vi.fn(async (args: NotificationCreateArgs) => {
  const rows = Array.isArray(args.data) ? args.data : [args.data];
  return rows.map((row, index) => ({ id: `n${index}`, recipientUserId: row.recipientUserId }));
});
const deliverEmails = vi.hoisted(() => vi.fn(async (emails: unknown[], actorUserId: string) => void [emails, actorUserId]));
vi.mock("@/lib/notifications/deliver", () => ({ deliverEmails }));

const qcResultCreate = vi.fn(async (args: QcResultCreateArgs) => ({ id: "qc1", ...args.data }));
const qcResultFindMany = vi.fn(async () => qcResults);
const qcSpecFindMany = vi.fn(async () => specs);
const deviationFindMany = vi.fn(async () => deviations);
const batchSignatureCreate = vi.fn(async (args: BatchSignatureCreateArgs) => ({ id: "sig1", ...args.data }));
const batchEventCreate = vi.fn(async (args: BatchEventCreateArgs) => ({ id: "ev1", ...args.data }));
const finishedProductLotCreate = vi.fn(async (args: FinishedProductLotCreateArgs) => ({ id: "lot1", ...args.data }));
const findFirst = vi.fn(async (): Promise<MockOrder | null> => order);
const updateMany = vi.fn(async (): Promise<{ count: number }> => ({ count: 1 }));

vi.mock("@/lib/db", () => ({
  withTenant: (_tenantId: string, _actorUserId: string, fn: (tx: unknown) => unknown) =>
    fn({
      qcResult: { create: qcResultCreate, findMany: qcResultFindMany },
      qcSpecification: { findMany: qcSpecFindMany },
      deviation: { findMany: deviationFindMany },
      batchSignature: { create: batchSignatureCreate },
      batchEvent: { create: batchEventCreate },
      finishedProductLot: { create: finishedProductLotCreate },
      productionOrder: { findFirst, updateMany },
      user: { findMany: userFindMany },
      notification: { createManyAndReturn: notificationCreateManyAndReturn },
    }),
}));

let hasReverification = true;
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ has: (): boolean => hasReverification }),
}));

import { qcRouter } from "../qc";

type Role = "calidad" | "director_tecnico" | "operario";
const caller = (role: Role) => qcRouter.createCaller({ user: { id: "u1", tenantId: "t1", role }, prisma: {} as never });

const ORDER_ID = "550e8400-e29b-41d4-a716-446655440000";

function resetState() {
  vi.clearAllMocks();
  hasReverification = true;
  order = { id: ORDER_ID, orderNumber: "OP-2026-001", formulaId: "f1", status: "calidad" };
  qcResults = [{ parameter: "pH", result: "pass" }];
  specs = [];
  deviations = [];
}

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  const err = await promise.then(() => undefined).catch((e: unknown) => e);
  return err instanceof TRPCError ? err.code : undefined;
}

describe("qc.recordResult", () => {
  beforeEach(resetState);

  const input = { productionOrderId: ORDER_ID, parameter: "pH", measuredValue: 8.9, result: "fail" as const };

  it("records a fail result for an order in 'calidad'", async () => {
    const result = await caller("calidad").recordResult(input);
    expect(result.result).toBe("fail");
    expect(findFirst).toHaveBeenCalledWith({ where: { id: ORDER_ID, tenantId: "t1" } });
    expect(qcResultCreate).toHaveBeenCalled();
  });

  // Final review (Important 5): QC is only recorded during the `calidad` stage.
  it.each(["mezclado", "envasado", "liberado", "rechazado"])(
    "rejects a result for an order in '%s'",
    async (status) => {
      order = { ...order!, status };
      expect(await codeOf(caller("calidad").recordResult(input))).toBe("BAD_REQUEST");
      expect(qcResultCreate).not.toHaveBeenCalled();
    },
  );

  // Final review (Critical 2): a foreign/unknown order id is NOT_FOUND.
  it("rejects a result against an order outside the caller's tenant", async () => {
    order = null;
    expect(await codeOf(caller("calidad").recordResult(input))).toBe("NOT_FOUND");
    expect(qcResultCreate).not.toHaveBeenCalled();
  });

  // CLAUDE.md rule 7: the persisted verdict is the server's, not the client's.
  it("persists 'pass' when the value is inside the spec even if the client sent 'fail'", async () => {
    specs = [spec("pH", 5.5, 7)];
    const result = await caller("calidad").recordResult({ ...input, parameter: " PH ", measuredValue: 6.2, result: "fail" });
    expect(result.result).toBe("pass");
    expect(notificationCreateManyAndReturn).not.toHaveBeenCalled();
  });

  it("persists 'fail' when the value is outside the spec even if the client sent 'pass'", async () => {
    specs = [spec("pH", 5.5, 7)];
    const result = await caller("calidad").recordResult({ ...input, measuredValue: 8.9, result: "pass" });
    expect(result.result).toBe("fail");
  });

  it("treats the spec bounds as inclusive", async () => {
    specs = [spec("pH", 5.5, 7)];
    const result = await caller("calidad").recordResult({ ...input, measuredValue: 7, result: "fail" });
    expect(result.result).toBe("pass");
  });

  it("keeps the submitted verdict only when the parameter has no specification", async () => {
    specs = [spec("viscosidad", 1000, 2000)];
    const result = await caller("calidad").recordResult({ ...input, parameter: "color", result: "fail" });
    expect(result.result).toBe("fail");
  });

  it("notifies calidad, director_tecnico and jefe_planta on an out-of-spec result", async () => {
    specs = [spec("pH", 5.5, 7)];
    await caller("calidad").recordResult({ ...input, measuredValue: 8.9, result: "pass" });
    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: { in: ["calidad", "director_tecnico", "jefe_planta"] },
          id: { not: "u1" },
        }),
      }),
    );
    expect(notificationCreateManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            kind: "qc_fuera_de_especificacion",
            title: "QC fuera de especificación en OP-2026-001",
            link: `/produccion/${ORDER_ID}`,
          }),
        ],
      }),
    );
    expect(deliverEmails).toHaveBeenCalledWith([expect.objectContaining({ to: "jefe@lab.co" })], "u1");
  });

  it("sends no notification for a conforming result", async () => {
    specs = [spec("pH", 5.5, 7)];
    await caller("calidad").recordResult({ ...input, measuredValue: 6, result: "pass" });
    expect(notificationCreateManyAndReturn).not.toHaveBeenCalled();
    expect(deliverEmails).toHaveBeenCalledWith([], "u1");
  });
});

const decisionInput = {
  productionOrderId: ORDER_ID,
  meaningStatement: "Reviso los resultados de calidad y tomo esta decisión",
  reauthVerified: true as const,
};

describe("qc.release", () => {
  beforeEach(resetState);

  it("blocks release when a fail QC result exists", async () => {
    qcResults = [{ parameter: "pH", result: "fail" }];
    expect(await codeOf(caller("director_tecnico").release(decisionInput))).toBe("BAD_REQUEST");
    expect(updateMany).not.toHaveBeenCalled();
    expect(finishedProductLotCreate).not.toHaveBeenCalled();
  });

  it("blocks release when an open deviation exists", async () => {
    deviations = [{ status: "abierta" }];
    expect(await codeOf(caller("director_tecnico").release(decisionInput))).toBe("BAD_REQUEST");
    expect(updateMany).not.toHaveBeenCalled();
    expect(finishedProductLotCreate).not.toHaveBeenCalled();
  });

  // Final review (Important 5): zero QC results used to pass.
  it("blocks release when no QC result has been recorded at all", async () => {
    qcResults = [];
    expect(await codeOf(caller("director_tecnico").release(decisionInput))).toBe("BAD_REQUEST");
    expect(updateMany).not.toHaveBeenCalled();
    expect(finishedProductLotCreate).not.toHaveBeenCalled();
  });

  it("blocks release when a specified QC parameter has no result", async () => {
    specs = [spec("pH"), spec("Viscosidad")];
    const error = await caller("director_tecnico")
      .release(decisionInput)
      .catch((e: unknown) => e);
    expect((error as TRPCError).code).toBe("BAD_REQUEST");
    expect((error as TRPCError).message).toContain("Viscosidad");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("matches specified parameters case/whitespace-insensitively", async () => {
    specs = [spec(" PH ")];
    await caller("director_tecnico").release(decisionInput);
    expect(updateMany).toHaveBeenCalled();
  });

  it("rejects release when the server-side reverification check fails, even though the client claims reauthVerified: true", async () => {
    hasReverification = false;
    expect(await codeOf(caller("director_tecnico").release(decisionInput))).toBe("UNAUTHORIZED");
    expect(batchSignatureCreate).not.toHaveBeenCalled();
    expect(finishedProductLotCreate).not.toHaveBeenCalled();
  });

  it("rejects an empty meaningStatement even if reauthVerified is true", async () => {
    await expect(
      caller("director_tecnico").release({ productionOrderId: ORDER_ID, meaningStatement: "", reauthVerified: true }),
    ).rejects.toThrow();
  });

  it("treats an order outside the caller's tenant as NOT_FOUND", async () => {
    order = null;
    expect(await codeOf(caller("director_tecnico").release(decisionInput))).toBe("NOT_FOUND");
    expect(finishedProductLotCreate).not.toHaveBeenCalled();
  });

  it("advances the order, signs, and creates a FinishedProductLot when QC is clean", async () => {
    specs = [spec("pH")];
    const result = await caller("director_tecnico").release(decisionInput);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: ORDER_ID, tenantId: "t1", status: "calidad" },
      data: { status: "liberado" },
    });
    expect(batchSignatureCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productionOrderId: ORDER_ID,
          stage: "liberado",
          signedBy: "u1",
          reauthVerified: true,
          meaningStatement: decisionInput.meaningStatement,
        }),
      }),
    );
    expect(finishedProductLotCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "t1",
          productionOrderId: ORDER_ID,
          code: "OP-2026-001",
          releasedBy: "u1",
        }),
      }),
    );
    expect(result.lot.code).toBe("OP-2026-001");
  });
});

// Final review (Important 4): `calidad -> rechazado` had no caller at all.
describe("qc.reject", () => {
  beforeEach(resetState);

  it("rejects a batch in 'calidad': advances to 'rechazado', writes the signature + event, no finished lot", async () => {
    qcResults = [{ parameter: "pH", result: "fail" }];
    deviations = [{ status: "abierta" }];

    const result = await caller("director_tecnico").reject(decisionInput);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: ORDER_ID, tenantId: "t1", status: "calidad" },
      data: { status: "rechazado" },
    });
    expect(batchSignatureCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productionOrderId: ORDER_ID,
          stage: "rechazado",
          signedBy: "u1",
          reauthVerified: true,
          meaningStatement: decisionInput.meaningStatement,
        }),
      }),
    );
    expect(batchEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "signature", payload: { stage: "rechazado", signatureId: "sig1" } }),
      }),
    );
    expect(finishedProductLotCreate).not.toHaveBeenCalled();
    expect(result.signature.stage).toBe("rechazado");
  });

  it.each(["calidad", "operario"] as const)("forbids the '%s' role from rejecting", async (role) => {
    expect(await codeOf(caller(role).reject(decisionInput))).toBe("FORBIDDEN");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("requires the server-side reverification check, even though the client claims reauthVerified: true", async () => {
    hasReverification = false;
    expect(await codeOf(caller("director_tecnico").reject(decisionInput))).toBe("UNAUTHORIZED");
    expect(batchSignatureCreate).not.toHaveBeenCalled();
  });

  it("requires an explicit meaning statement and reauthVerified: true", async () => {
    await expect(
      caller("director_tecnico").reject({ productionOrderId: ORDER_ID, meaningStatement: "", reauthVerified: true }),
    ).rejects.toThrow();
    await expect(
      caller("director_tecnico").reject({ ...decisionInput, reauthVerified: false as unknown as true }),
    ).rejects.toThrow();
    expect(batchSignatureCreate).not.toHaveBeenCalled();
  });

  it("refuses to reject an order that is not in 'calidad' (state machine)", async () => {
    order = { ...order!, status: "envasado" };
    expect(await codeOf(caller("director_tecnico").reject(decisionInput))).toBe("BAD_REQUEST");
    expect(batchSignatureCreate).not.toHaveBeenCalled();
  });

  it("treats an order outside the caller's tenant as NOT_FOUND", async () => {
    order = null;
    expect(await codeOf(caller("director_tecnico").reject(decisionInput))).toBe("NOT_FOUND");
    expect(batchSignatureCreate).not.toHaveBeenCalled();
  });
});
