import { db, type PendingEvent } from "./db";

// Browser-only, zero Prisma dependency (see `db.ts`) — safe for
// `WeighingForm.tsx`/`OfflineIndicator.tsx` to import directly.

export async function queueEvent(event: PendingEvent): Promise<void> {
  await db.pendingEvents.add(event);
}

type SyncResult = { clientEventId: string; status: "accepted" | "duplicate" };

export async function syncPendingEvents(): Promise<{ pushed: number; duplicates: number }> {
  const pending = (await db.pendingEvents.toArray()).filter((e) => !e.pushedAt);
  if (pending.length === 0) return { pushed: 0, duplicates: 0 };

  const res = await fetch("/api/sync/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events: pending }),
  });
  if (!res.ok) return { pushed: 0, duplicates: 0 };

  const body = (await res.json()) as { success: boolean; results: SyncResult[] };
  let pushed = 0;
  let duplicates = 0;
  for (const r of body.results) {
    await db.pendingEvents.update(r.clientEventId, { pushedAt: new Date().toISOString() });
    if (r.status === "accepted") pushed++;
    else duplicates++;
  }
  return { pushed, duplicates };
}
