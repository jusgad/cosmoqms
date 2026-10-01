import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

// Architecture (Task 14, Option A): this route runs offline-captured
// `weighing` events through the same server-side logic as
// `production.recordWeighing` — since the final review both call
// `applyWeighing` (validation, server-side theoreticalQty, stock decrement,
// stage advance; covered in lib/production/__tests__/weighing.test.ts). These
// tests cover the route's own responsibilities: auth, body validation (4xx,
// never a retry-forever 5xx), per-event transactions, duplicate handling
// without side effects, and per-event business-rule rejections.

const { applyWeighing } = vi.hoisted(() => ({ applyWeighing: vi.fn(async () => ({ id: "ev1" })) }));
vi.mock("@/lib/production/weighing", () => ({ applyWeighing }));

const findFirst = vi.fn(async (): Promise<{ id: string } | null> => null);
const withTenant = vi.fn((_tenantId: string, _actorUserId: string, fn: (tx: unknown) => unknown) =>
  fn({ batchEvent: { findFirst } }),
);
vi.mock("@/lib/db", () => ({
  withTenant: (tenantId: string, actorUserId: string, fn: (tx: unknown) => unknown) =>
    withTenant(tenantId, actorUserId, fn),
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

const EVENT_1 = "11111111-1111-4111-8111-111111111111";
const EVENT_2 = "22222222-2222-4222-8222-222222222222";
const ORDER_ID = "550e8400-e29b-41d4-a716-446655440000";

function makeRequest(events: Record<string, unknown>[]) {
  return new Request("http://localhost/api/sync/events", { method: "POST", body: JSON.stringify({ events }) });
}

function weighingEvent(overrides: Record<string, unknown> = {}) {
  return {
    clientEventId: EVENT_1,
    productionOrderId: ORDER_ID,
    eventType: "weighing",
    payload: { rawMaterialLotId: "550e8400-e29b-41d4-a716-446655440001", theoreticalQty: 10, actualQty: 9.9 },
    occurredAt: new Date().toISOString(),
    deviceId: "d1",
    ...overrides,
  };
}

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`client_event_id`)", {
    code: "P2002",
    clientVersion: "test",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  findFirst.mockResolvedValue(null);
  applyWeighing.mockResolvedValue({ id: "ev1" });
  requireRole.mockResolvedValue({ id: "u1", tenantId: "t1", role: "operario" as const });
});

describe("POST /api/sync/events", () => {
  it("applies a new weighing with the caller's tenant/actor and reports it accepted", async () => {
    const res = await POST(makeRequest([weighingEvent()]));
    const body = await res.json();

    expect(withTenant).toHaveBeenCalledWith("t1", "u1", expect.any(Function));
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "t1", clientEventId: EVENT_1 } }),
    );
    expect(applyWeighing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: "t1",
        actorUserId: "u1",
        productionOrderId: ORDER_ID,
        rawMaterialLotId: "550e8400-e29b-41d4-a716-446655440001",
        actualQty: 9.9,
        clientEventId: EVENT_1,
        deviceId: "d1",
      }),
    );
    expect(body).toEqual({ success: true, results: [{ clientEventId: EVENT_1, status: "accepted" }] });
  });

  // CLAUDE.md rule 6: a retried clientEventId is never applied twice — no
  // second stock decrement, no second stage advance.
  it("reports an already-synced clientEventId as duplicate without applying it again", async () => {
    findFirst.mockResolvedValueOnce({ id: "existing" });
    const res = await POST(makeRequest([weighingEvent()]));
    const body = await res.json();

    expect(applyWeighing).not.toHaveBeenCalled();
    expect(body.results).toEqual([{ clientEventId: EVENT_1, status: "duplicate" }]);
  });

  it("reports a concurrent duplicate (P2002 from the insert race) as duplicate", async () => {
    applyWeighing.mockRejectedValueOnce(uniqueViolation());
    const res = await POST(makeRequest([weighingEvent()]));
    const body = await res.json();

    expect(body.results).toEqual([{ clientEventId: EVENT_1, status: "duplicate" }]);
    expect(body.success).toBe(true);
  });

  // Important 7a: a weighing for a closed/released batch (or any other
  // business-rule failure) is a per-event rejection with the reason — never
  // silently accepted, never a whole-batch failure.
  it("reports a business-rule rejection for that event only, with its reason", async () => {
    applyWeighing
      .mockRejectedValueOnce(new TRPCError({ code: "BAD_REQUEST", message: "La orden está en 'liberado' — ya no admite pesajes" }))
      .mockResolvedValueOnce({ id: "ev2" });

    const res = await POST(makeRequest([weighingEvent(), weighingEvent({ clientEventId: EVENT_2 })]));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toEqual([
      { clientEventId: EVENT_1, status: "rejected", reason: "La orden está en 'liberado' — ya no admite pesajes" },
      { clientEventId: EVENT_2, status: "accepted" },
    ]);
    // Each event ran in its own transaction.
    expect(withTenant).toHaveBeenCalledTimes(2);
  });

  it("reports an order/lot outside the caller's tenant (NOT_FOUND) as rejected", async () => {
    applyWeighing.mockRejectedValueOnce(new TRPCError({ code: "NOT_FOUND", message: "Orden de producción no encontrada" }));
    const body = await (await POST(makeRequest([weighingEvent()]))).json();
    expect(body.results).toEqual([{ clientEventId: EVENT_1, status: "rejected", reason: "Orden de producción no encontrada" }]);
  });

  it("re-throws a genuinely unexpected error (transient 5xx, device retries later)", async () => {
    applyWeighing.mockRejectedValueOnce(new Error("connection reset"));
    await expect(POST(makeRequest([weighingEvent()]))).rejects.toThrow("connection reset");
  });

  it("rejects a caller whose role is not allowed to capture offline events", async () => {
    requireRole.mockRejectedValueOnce(new MockForbiddenError());
    const res = await POST(makeRequest([weighingEvent()]));
    expect(res.status).toBe(403);
    expect(applyWeighing).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller", async () => {
    requireRole.mockRejectedValueOnce(new MockUnauthorizedError());
    const res = await POST(makeRequest([weighingEvent()]));
    expect(res.status).toBe(401);
    expect(applyWeighing).not.toHaveBeenCalled();
  });

  // Important 7b: malformed input is a permanent 4xx, never an uncaught 500
  // that `sync-engine.ts` would retry forever.
  it("returns 400 (not a thrown error / 500) for an event type other than 'weighing'", async () => {
    const res = await POST(makeRequest([weighingEvent({ eventType: "signature" })]));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(Array.isArray(body.issues)).toBe(true);
    expect(applyWeighing).not.toHaveBeenCalled();
  });

  it("returns 400 for a payload missing the fields recordWeighingInput requires", async () => {
    const res = await POST(makeRequest([weighingEvent({ payload: { rawMaterialLotId: "not-a-uuid" } })]));
    expect(res.status).toBe(400);
    expect(applyWeighing).not.toHaveBeenCalled();
  });

  it("returns 400 for an unparseable occurredAt", async () => {
    const res = await POST(makeRequest([weighingEvent({ occurredAt: "yesterday-ish" })]));
    expect(res.status).toBe(400);
    expect(applyWeighing).not.toHaveBeenCalled();
  });

  it("returns 400 for a body that is not JSON at all", async () => {
    const res = await POST(new Request("http://localhost/api/sync/events", { method: "POST", body: "{not json" }));
    expect(res.status).toBe(400);
    expect(applyWeighing).not.toHaveBeenCalled();
  });
});
