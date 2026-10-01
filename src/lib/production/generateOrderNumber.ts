import type { Prisma } from "@prisma/client";

// Consumed only by production.create. Format: OP-YYYY-NNN, consecutive per
// tenant per year. See task-9-report.md for the concurrency disclosure on
// the count-then-create race window — the database-level backstop for that
// race is `ProductionOrder`'s `@@unique([tenantId, orderNumber])`.
//
// Final-review fix (Critical 1 follow-up): the count now runs through the
// caller's `tx` (the same `withTenant` transaction that inserts the order),
// never the top-level `prisma` client. Outside `withTenant`,
// `app.current_tenant_id` is never set, so once RLS is enforced a bare
// `prisma.productionOrder.count(...)` would see zero rows for every tenant
// and hand out `OP-<year>-001` forever. It also filters by `tenantId`
// explicitly (defense in depth, same convention as every router).
export async function generateOrderNumber(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await tx.productionOrder.count({
    where: { tenantId, orderNumber: { startsWith: `OP-${year}-` } },
  });
  return `OP-${year}-${String(count + 1).padStart(3, "0")}`;
}
