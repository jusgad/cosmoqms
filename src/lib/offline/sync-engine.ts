import { db, type PendingEvent } from "./db";

// Browser-only, zero Prisma dependency (see `db.ts`) — safe for
// `WeighingForm.tsx`/`OfflineIndicator.tsx` to import directly.

export async function queueEvent(event: PendingEvent): Promise<void> {
  await db.pendingEvents.add(event);
}

// `rejected` (final review, Important 7a): the server refused THIS event on a
// business rule (e.g. its batch is already closed, the lot isn't released,
// insufficient stock). Like a 4xx it will never succeed by retrying, so it is
// marked `failedAt` with the server's reason — but only that event, not the
// rest of the batch, which was processed independently.
type SyncResult =
  | { clientEventId: string; status: "accepted" | "duplicate" }
  | { clientEventId: string; status: "rejected"; reason: string };

export async function syncPendingEvents(): Promise<{ pushed: number; duplicates: number; failed: number }> {
  // Review round 1 fix (Important Finding 2): a previously hard-failed event
  // (`failedAt` set) is excluded from every future retry — resending it
  // would hit the same 4xx again. It stays visible via `OfflineIndicator`
  // until someone actively addresses it (not built here — out of this
  // task's proportionate scope, see task-14-report.md).
  const pending = (await db.pendingEvents.toArray()).filter((e) => !e.pushedAt && !e.failedAt);
  if (pending.length === 0) return { pushed: 0, duplicates: 0, failed: 0 };

  let res: Response;
  try {
    res = await fetch("/api/sync/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: pending }),
    });
  } catch {
    // Network failure (offline, DNS, server unreachable) — transient, leave
    // everything pending for the next retry.
    return { pushed: 0, duplicates: 0, failed: 0 };
  }

  // A 4xx means the server explicitly rejected this batch as invalid (bad
  // auth, a malformed event/eventType that will never parse) — not "try
  // again later." Marking every event in the batch `failedAt` here is
  // deliberately coarse (the whole batch, not just the offending event):
  // `/api/sync/events` validates the whole request body in one `safeParse`
  // call before processing any event (400 on failure), so one malformed
  // event already prevents the rest of the batch from being attempted at all.
  // Per-event BUSINESS-rule rejections are reported individually instead
  // (`status: "rejected"`, handled below).
  if (res.status >= 400 && res.status < 500) {
    const failedAt = new Date().toISOString();
    const lastError = `HTTP ${res.status}`;
    for (const e of pending) {
      await db.pendingEvents.update(e.clientEventId, { failedAt, lastError });
    }
    return { pushed: 0, duplicates: 0, failed: pending.length };
  }

  if (!res.ok) {
    // 5xx or other transient server-side failure — leave pending, retry later.
    return { pushed: 0, duplicates: 0, failed: 0 };
  }

  const body = (await res.json()) as { success: boolean; results: SyncResult[] };
  let pushed = 0;
  let duplicates = 0;
  let failed = 0;
  for (const r of body.results) {
    if (r.status === "rejected") {
      await db.pendingEvents.update(r.clientEventId, { failedAt: new Date().toISOString(), lastError: r.reason });
      failed++;
      continue;
    }
    await db.pendingEvents.update(r.clientEventId, { pushedAt: new Date().toISOString() });
    if (r.status === "accepted") pushed++;
    else duplicates++;
  }
  return { pushed, duplicates, failed };
}
