import { PrismaClient, Prisma } from "@prisma/client";
import { withAuditLog } from "@/lib/audit";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Task 17 review round 1 (Critical fix): `withAuditLog` must be applied to
// the top-level `prisma` client BEFORE `$transaction` opens, not to the `tx`
// interactive-transaction client returned inside the callback.
// `Prisma.TransactionClient` is typed as `Omit<PrismaClient, ITXClientDenyList>`,
// and `ITXClientDenyList` explicitly strips `$extends` (along with
// `$transaction`, `$connect`, `$disconnect`) from `tx` — at runtime `tx` is a
// deny-list Proxy whose `$extends` resolves to `undefined`, so calling
// `tx.$extends(...)` throws `TypeError: ...$extends is not a function`. The
// earlier version of this function did exactly that and would have broken
// every single `withTenant` call at runtime, invisibly, because the
// `as unknown as PrismaClient` cast suppressed the compile-time type error.
//
// The fix: extend `prisma` first, then call `.$transaction` on the already
// -extended client — Prisma propagates a pre-applied extension into the
// `tx` object `$transaction`'s callback receives, so `fn` still gets a
// `tx` whose regulated-model writes are audited, without ever needing to
// call `$extends` on `tx` itself.
//
// Task 17 review round 2 (Critical fix): applying the extension before the
// transaction opens creates a second problem — inside the `$allOperations`
// hook, the *audit* write (`auditLog.create`, a different model than the one
// being intercepted) needs the SAME active `tx` as the write it's auditing,
// but the hook closes over whatever client reference it's given at
// `withAuditLog(prisma, ...)`'s call time, which is the plain top-level
// `prisma` — not `tx` (which doesn't exist yet at that point). See
// `withAuditLog`'s own doc comment in `audit.ts` for the full investigation
// (including why the initially-suggested `Prisma.getExtensionContext(this)`
// fix doesn't work for `$allModels.$allOperations` in this Prisma version,
// verified empirically). The fix here: `withAuditLog` now returns both the
// extended `client` to open the transaction on, and a `bindTransactionClient`
// callback — called immediately with the real `tx` as the FIRST thing inside
// `$transaction`'s callback, before `fn` (the caller's mutation) runs, so
// every audit write inside this transaction is issued through the genuine
// active `tx`, not the pre-transaction `prisma`.
//
// Every write inside this transaction still goes through `withAuditLog`
// before `fn` sees `tx`, so a mutation on a regulated table and its
// `audit_log` row still commit or roll back together in the same
// `$transaction` callback.
//
// The parameterized `set_config` call below (fixed in a prior review round
// for a SQL-injection concern) is preserved as-is — this task only changes
// the signature/wrapping, not the tenant-scoping SQL itself.
export async function withTenant<T>(
  tenantId: string,
  actorUserId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (!tenantId) {
    throw new Error("withTenant: tenantId is required");
  }
  const { client: auditedPrisma, bindTransactionClient } = withAuditLog(prisma, actorUserId, tenantId);
  return auditedPrisma.$transaction(async (tx) => {
    bindTransactionClient(tx as unknown as PrismaClient);
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}
