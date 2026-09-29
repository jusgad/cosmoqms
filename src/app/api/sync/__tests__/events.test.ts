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
// `weighing` event.
//
// Review round 1 fixes (Critical Findings 1 & 2, Important Finding 1) layer
// on top of that resolution:
//   - Each event now commits in its OWN `withTenant` transaction (Critical
//     1) — a redundant stage-advance (the normal case for a
//     multi-ingredient formula's several `weighing` events against the same
//     order) is caught and turned into a silent no-op rather than an error
//     that would otherwise roll back every event in a shared transaction.
//   - The route is now role-gated via `requireRole` (Critical 2), matching
//     `production.recordWeighing`'s own gate.
//   - `eventType` is a `z.literal("weighing")` and `payload` is validated
//     against the same shape `recordWeighingInput` requires (Important 1),
//     not an unrestricted `z.string()`/`z.unknown()`.
type MockOrder = { id: string; status: "planificado" | "pesado" | "mezclado" };

const create = vi.fn();
const findUniqueOrThrow = vi.fn(async (): Promise<MockOrder> => ({ id: "po1", status: "planificado" }));
const updateMany = vi.fn(async (): Promise<{ count: number }> => ({ count: 1 }));

vi.mock("@/lib/db", () => ({
  withTenant: (_tenantId: string, fn: (tx: unknown) => unknown) =>
    fn({ batchEvent: { create }, productionOrder: { findUniqueOrThrow, updateMany } }),
}));

const { requireRole, MockUnauthorizedError, MockForbiddenError } = vi.hoisted(() => {
  class MockUnauthorizedError extends Error {}
  class MockForbiddenError extends Error {}
  return {
    requireRole: vi.fn(async () => ({ id: "u1", tenantId: "t1", role: "operario" as const })),
    MockUnauthorizedError,
    MockForbiddenError,
  };
});
vi.mock("@/lib/auth", () => ({
  requireRole,
  UnauthorizedError: MockUnauthorizedError,
  ForbiddenError: MockForbiddenError,
}));

import { POST } from "../events/route";

function makeRequest(events: Record<string, unknown>[]) {
  return new Request("http://localhost/api/sync/events", {
    method: "POST",
    body: JSON.stringify({ events }),
  });
}

function weighingEvent(overrides: Record<string, unknown> = {}) {
  return {
    clientEventId: "11111111-1111-4111-8111-111111111111",
    productionOrderId: "550e8400-e29b-41d4-a716-446655440000",
    eventType: "weighing",
    payload: { rawMaterialLotId: "550e8400-e29b-41d4-a716-446655440001", theoreticalQty: 10, actualQty: 9.9 },
    occurredAt: new Date().toISOString(),
    deviceId: "d1",
    ...overrides,
  };
}

beforeEach(() => {
  create.mockReset();
  findUniqueOrThrow.mockClear();
  updateMany.mockClear();
  requireRole.mockClear();
  requireRole.mockResolvedValue({ id: "u1", tenantId: "t1", role: "operario" as const });
});

describe("POST /api/sync/events", () => {
  it("creates the batch_events row without update/delete and reports success", async () => {
    create.mockResolvedValueOnce({ id: "ev1" });
    const res = await POST(makeRequest([weighingEvent()]));
    const body = await res.json();

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "weighing", clientEventId: "11111111-1111-4111-8111-111111111111" }),
      }),
    );
    expect(body.success).toBe(true);
  });

  it("advances a genuinely-new weighing event to 'pesado', exactly like production.recordWeighing", async () => {
    create.mockResolvedValueOnce({ id: "ev1" });
    const res = await POST(makeRequest([weighingEvent()]));
    const body = await res.json();

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "550e8400-e29b-41d4-a716-446655440000", status: "planificado" },
        data: { status: "pesado" },
      }),
    );
    expect(body.results).toEqual([{ clientEventId: "11111111-1111-4111-8111-111111111111", status: "accepted" }]);
  });

  it("never re-advances the stage for a duplicate clientEventId retry", async () => {
    create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`client_event_id`)", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    const res = await POST(makeRequest([weighingEvent()]));
    const body = await res.json();

    expect(updateMany).not.toHaveBeenCalled();
    expect(body.results).toEqual([{ clientEventId: "11111111-1111-4111-8111-111111111111", status: "duplicate" }]);
    expect(body.success).toBe(true);
  });

  it("re-throws a non-duplicate database error instead of silently swallowing it", async () => {
    create.mockRejectedValueOnce(new Error("connection reset"));
    await expect(POST(makeRequest([weighingEvent()]))).rejects.toThrow("connection reset");
    expect(updateMany).not.toHaveBeenCalled();
  });

  // Critical Finding 1 regression test: a multi-ingredient formula's
  // `WeighingForm` queues one `weighing` event per ingredient, all against
  // the SAME production order — the normal case, not an edge case. The
  // second event's stage-advance attempt must be a silent no-op (the order
  // is already at `pesado`), never an error that rolls back the first
  // event's already-successful write, and never something that blocks the
  // second event's own `BatchEvent` row from persisting either.
  it("persists both weighing events for the same order in one sync call, advancing the stage exactly once", async () => {
    create.mockResolvedValueOnce({ id: "ev1" }).mockResolvedValueOnce({ id: "ev2" });
    // First event's advance: order is `planificado` -> `pesado` succeeds.
    // `advanceStageInternal` reads the order twice on a successful advance
    // (once to check `canTransition`, once more at the end to return the
    // now-updated row), hence three queued reads total, not two. Second
    // event's advance: order is now `pesado` -> `canTransition` returns
    // false -> `advanceStageInternal` throws BAD_REQUEST before ever
    // touching `updateMany` again, which the route must catch as a no-op.
    findUniqueOrThrow
      .mockResolvedValueOnce({ id: "po1", status: "planificado" as const })
      .mockResolvedValueOnce({ id: "po1", status: "pesado" as const })
      .mockResolvedValueOnce({ id: "po1", status: "pesado" as const });

    const secondEvent = weighingEvent({
      clientEventId: "22222222-2222-4222-8222-222222222222",
      payload: { rawMaterialLotId: "550e8400-e29b-41d4-a716-446655440002", theoreticalQty: 5, actualQty: 5.1 },
    });

    const res = await POST(makeRequest([weighingEvent(), secondEvent]));
    const body = await res.json();

    expect(create).toHaveBeenCalledTimes(2);
    expect(body.results).toEqual([
      { clientEventId: "11111111-1111-4111-8111-111111111111", status: "accepted" },
      { clientEventId: "22222222-2222-4222-8222-222222222222", status: "accepted" },
    ]);
    // The order ends up at `pesado` via exactly one stage transition, not
    // two, and not zero (i.e. it never got stuck, and it never errored).
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "550e8400-e29b-41d4-a716-446655440000", status: "planificado" } }),
    );
  });

  // Critical Finding 2 regression test.
  it("rejects a caller whose role is not allowed to capture offline events", async () => {
    requireRole.mockRejectedValueOnce(new MockForbiddenError());
    const res = await POST(makeRequest([weighingEvent()]));
    expect(res.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller", async () => {
    requireRole.mockRejectedValueOnce(new MockUnauthorizedError());
    const res = await POST(makeRequest([weighingEvent()]));
    expect(res.status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });

  // Important Finding 1 regression test.
  it("rejects an event type other than 'weighing' — no dedicated offline-capture flow exists for it", async () => {
    await expect(POST(makeRequest([weighingEvent({ eventType: "signature" })]))).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a payload missing the fields recordWeighingInput requires", async () => {
    await expect(POST(makeRequest([weighingEvent({ payload: { rawMaterialLotId: "not-a-uuid" } })]))).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });
});
