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
};

const db = new Dexie("cosmoqms-offline") as Dexie & {
  pendingEvents: EntityTable<PendingEvent, "clientEventId">;
};

db.version(1).stores({ pendingEvents: "clientEventId, pushedAt" });

export { db };
