import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// Architecture-gap resolution (see task-14-report.md for full reasoning):
// the brief's literal Step 9 route only does `batchEvent.createMany({
// skipDuplicates: true })` and never calls `advanceStageInternal`. Taken
// literally, an offline-captured `weighing` event synced through this route
// would create a `BatchEvent` row but leave the order stuck in
// `planificado` forever, breaking Task 10's core guarantee. Resolved as
// Option A (the blueprint's own language: this endpoint "corre bajo la
// misma máquina de estados que las mutaciones tRPC") — this route mirrors
// `production.recordWeighing`'s side effect for each genuinely-new
// `weighing` event, in the same transaction.
//
// This requires per-event idempotency detection, which `createMany`'s
// return value (`{ count }`) cannot provide — it reports how many rows were
// inserted in total, not which of the input rows were skipped as
// duplicates. So this route iterates with individual `tx.batchEvent.create`
// calls, treating a Prisma unique-constraint violation (`P2002` on
// `client_event_id`) as "this is a duplicate retry, do not advance the
// stage again" — never a second, real `create`/`update` on `batch_events`
// row: only the query used to *detect* the duplicate `Postgres` throws it.
const create = vi.fn();
const findUniqueOrThrow = vi.fn(async () => ({ id: "po1", status: "planificado" as const }));
const updateMany = vi.fn(async (): Promise<{ count: number }> => ({ count: 1 }));

vi.mock("@/lib/db", () => ({
  withTenant: (_tenantId: string, fn: (tx: unknown) => unknown) =>
    fn({ batchEvent: { create }, productionOrder: { findUniqueOrThrow, updateMany } }),
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => ({ id: "u1", tenantId: "t1", role: "operario" }) }));

import { POST } from "../events/route";

function makeRequest(events: Record<string, unknown>[]) {
  return new Request("http://localhost/api/sync/events", {
    method: "POST",
    body: JSON.stringify({ events }),
  });
}

const weighingEvent = {
  clientEventId: "11111111-1111-4111-8111-111111111111",
  productionOrderId: "550e8400-e29b-41d4-a716-446655440000",
  eventType: "weighing",
  payload: { rawMaterialLotId: "l1", theoreticalQty: 10, actualQty: 9.9 },
  occurredAt: new Date().toISOString(),
  deviceId: "d1",
};

beforeEach(() => {
  create.mockReset();
  findUniqueOrThrow.mockClear();
  updateMany.mockClear();
});

describe("POST /api/sync/events", () => {
  it("creates the batch_events row without update/delete and reports success", async () => {
    create.mockResolvedValueOnce({ id: "ev1" });
    const res = await POST(makeRequest([weighingEvent]));
    const body = await res.json();

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "weighing", clientEventId: weighingEvent.clientEventId }),
      }),
    );
    expect(body.success).toBe(true);
  });

  it("advances a genuinely-new weighing event to 'pesado', exactly like production.recordWeighing", async () => {
    create.mockResolvedValueOnce({ id: "ev1" });
    const res = await POST(makeRequest([weighingEvent]));
    const body = await res.json();

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: weighingEvent.productionOrderId, status: "planificado" },
        data: { status: "pesado" },
      }),
    );
    expect(body.results).toEqual([{ clientEventId: weighingEvent.clientEventId, status: "accepted" }]);
  });

  it("never re-advances the stage for a duplicate clientEventId retry", async () => {
    create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`client_event_id`)", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    const res = await POST(makeRequest([weighingEvent]));
    const body = await res.json();

    expect(updateMany).not.toHaveBeenCalled();
    expect(body.results).toEqual([{ clientEventId: weighingEvent.clientEventId, status: "duplicate" }]);
    expect(body.success).toBe(true);
  });

  it("does not advance the stage for non-weighing event types", async () => {
    create.mockResolvedValueOnce({ id: "ev2" });
    const res = await POST(
      makeRequest([{ ...weighingEvent, eventType: "note", clientEventId: "22222222-2222-4222-8222-222222222222" }]),
    );
    const body = await res.json();

    expect(updateMany).not.toHaveBeenCalled();
    expect(body.results[0].status).toBe("accepted");
  });

  it("re-throws a non-duplicate database error instead of silently swallowing it", async () => {
    create.mockRejectedValueOnce(new Error("connection reset"));
    await expect(POST(makeRequest([weighingEvent]))).rejects.toThrow("connection reset");
    expect(updateMany).not.toHaveBeenCalled();
  });
});
