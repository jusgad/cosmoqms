import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PendingEvent } from "../db";

const events: PendingEvent[] = [];
vi.mock("../db", () => ({
  db: {
    pendingEvents: {
      toArray: async () => events.filter((e) => !e.pushedAt),
      update: async (id: string, changes: Partial<PendingEvent>) => {
        const e = events.find((x) => x.clientEventId === id);
        if (e) Object.assign(e, changes);
      },
      add: async (e: PendingEvent) => {
        events.push(e);
      },
    },
  },
}));

type MockFetchResponse = {
  ok: boolean;
  status?: number;
  json: () => Promise<{ success: boolean; results: { clientEventId: string; status: string; reason?: string }[] }>;
};

const fetchMock = vi.fn(
  async (): Promise<MockFetchResponse> => ({
    ok: true,
    json: async () => ({ success: true, results: [{ clientEventId: "e1", status: "accepted" }] }),
  }),
);
vi.stubGlobal("fetch", fetchMock);

import { queueEvent, syncPendingEvents } from "../sync-engine";

beforeEach(() => {
  events.length = 0;
  fetchMock.mockClear();
});

describe("sync-engine", () => {
  it("queues locally without calling fetch", async () => {
    await queueEvent({
      clientEventId: "e1",
      productionOrderId: "po1",
      eventType: "weighing",
      payload: {},
      occurredAt: "now",
      deviceId: "d1",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(events).toHaveLength(1);
  });

  it("pushes only un-pushed events and marks them pushed on success", async () => {
    events.push({
      clientEventId: "e1",
      productionOrderId: "po1",
      eventType: "weighing",
      payload: {},
      occurredAt: "now",
      deviceId: "d1",
    });
    const result = await syncPendingEvents();
    expect(fetchMock).toHaveBeenCalledWith("/api/sync/events", expect.objectContaining({ method: "POST" }));
    expect(result.pushed).toBe(1);
    expect(events[0].pushedAt).toBeDefined();
  });

  it("does not double-count a duplicate reported back by the server", async () => {
    events.push({
      clientEventId: "e1",
      productionOrderId: "po1",
      eventType: "weighing",
      payload: {},
      occurredAt: "now",
      deviceId: "d1",
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, results: [{ clientEventId: "e1", status: "duplicate" }] }),
    });
    const result = await syncPendingEvents();
    expect(result.pushed).toBe(0);
    expect(result.duplicates).toBe(1);
    expect(events[0].pushedAt).toBeDefined();
  });

  // Review round 1 fix (Important Finding 2): a 4xx means the server
  // explicitly rejected the batch (bad auth, malformed event) — not "try
  // again later." This must be distinguishable from a transient/offline
  // failure so `OfflineIndicator` can surface it instead of looking
  // identical to "still pending."
  it("marks events failedAt on a 4xx rejection instead of leaving them silently pending", async () => {
    events.push({
      clientEventId: "e1",
      productionOrderId: "po1",
      eventType: "weighing",
      payload: {},
      occurredAt: "now",
      deviceId: "d1",
    });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ success: false, results: [] }) });

    const result = await syncPendingEvents();

    expect(result.failed).toBe(1);
    expect(result.pushed).toBe(0);
    expect(events[0].failedAt).toBeDefined();
    expect(events[0].pushedAt).toBeUndefined();
  });

  it("never resends an already-failed event on a later sync attempt", async () => {
    events.push({
      clientEventId: "e1",
      productionOrderId: "po1",
      eventType: "weighing",
      payload: {},
      occurredAt: "now",
      deviceId: "d1",
      failedAt: new Date().toISOString(),
      lastError: "HTTP 403",
    });

    const result = await syncPendingEvents();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ pushed: 0, duplicates: 0, failed: 0 });
  });

  it("leaves events pending (not failed) on a transient network error", async () => {
    events.push({
      clientEventId: "e1",
      productionOrderId: "po1",
      eventType: "weighing",
      payload: {},
      occurredAt: "now",
      deviceId: "d1",
    });
    fetchMock.mockRejectedValueOnce(new Error("network unreachable"));

    const result = await syncPendingEvents();

    expect(result).toEqual({ pushed: 0, duplicates: 0, failed: 0 });
    expect(events[0].failedAt).toBeUndefined();
    expect(events[0].pushedAt).toBeUndefined();
  });

  // Final review (Important 7a): a per-event business-rule rejection marks
  // ONLY that event failed (with the server's reason); the rest of the batch
  // is still marked pushed.
  it("marks only the server-rejected event failed, with the server's reason", async () => {
    for (const id of ["e1", "e2"]) {
      events.push({
        clientEventId: id,
        productionOrderId: "po1",
        eventType: "weighing",
        payload: {},
        occurredAt: "now",
        deviceId: "d1",
      });
    }
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        results: [
          { clientEventId: "e1", status: "rejected", reason: "La orden está en 'liberado' — ya no admite pesajes" },
          { clientEventId: "e2", status: "accepted" },
        ],
      }),
    });

    const result = await syncPendingEvents();

    expect(result).toEqual({ pushed: 1, duplicates: 0, failed: 1 });
    expect(events[0].failedAt).toBeDefined();
    expect(events[0].pushedAt).toBeUndefined();
    expect(events[0].lastError).toBe("La orden está en 'liberado' — ya no admite pesajes");
    expect(events[1].pushedAt).toBeDefined();
    expect(events[1].failedAt).toBeUndefined();
  });
});
