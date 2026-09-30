import { PrismaClient, Prisma } from "@prisma/client";
import { withAuditLog } from "@/lib/audit";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Task 17: every write inside this transaction now goes through
// `withAuditLog` before `fn` ever sees `tx`, so a mutation on a regulated
// table and its `audit_log` row commit or roll back together — the
// extension is applied *inside* this same `prisma.$transaction` callback,
// never as a separate write afterwards. `actorUserId` identifies who
// performed the mutation for `audit_log.actor_user_id` (CLAUDE.md rule 2).
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
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
    const auditedTx = withAuditLog(tx as unknown as PrismaClient, actorUserId, tenantId);
    return fn(auditedTx as unknown as Prisma.TransactionClient);
  });
}
