import Dexie, { type EntityTable } from "dexie";

// Browser-only (Dexie/IndexedDB), zero Prisma dependency — safe to import
// directly into Client Components (the Task 7 bundle-safety lesson this
// module deliberately satisfies: `WeighingForm.tsx` and `OfflineIndicator.tsx`
// import this file directly, never a `@/lib/trpc/router/*` file).
export type PendingEvent = {
  clientEventId: string;
  productionOrderId: string;
  eventType: string;
  payload: unknown;
  occurredAt: string;
  deviceId: string;
  pushedAt?: string;
  // Review round 1 fix (Important Finding 2): a 4xx from `/api/sync/events`
  // means the server explicitly rejected this event — it will never succeed
  // by simply retrying (bad auth, malformed payload/eventType) — as opposed
  // to a network failure or a 5xx, which are transient and should keep
  // retrying silently. `failedAt`/`lastError` let `OfflineIndicator`
  // distinguish "still trying" from "permanently failing" instead of both
  // looking like an identical, silent "pending" count forever.
  failedAt?: string;
  lastError?: string;
};

const db = new Dexie("cosmoqms-offline") as Dexie & {
  pendingEvents: EntityTable<PendingEvent, "clientEventId">;
};

db.version(1).stores({ pendingEvents: "clientEventId, pushedAt" });

export { db };
