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

const fetchMock = vi.fn(async () => ({
  ok: true,
  json: async () => ({ success: true, results: [{ clientEventId: "e1", status: "accepted" }] }),
}));
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
});
