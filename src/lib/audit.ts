import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

// CLAUDE.md rule 2 ("Toda mutación sobre una tabla regulada... debe escribir
// en audit_log en la misma transacción") scopes this to exactly the 5
// regulated tables it names — not every model in the schema.
const REGULATED_MODELS = new Set([
  "ProductionOrder",
  "BatchEvent",
  "QcResult",
  "Deviation",
  "FinishedProductLot",
]);

const WRITE_OPS = new Set(["create", "update", "delete", "createMany", "updateMany", "deleteMany"]);

// Zero-`any` note: Prisma's `$allOperations` extension callback is typed
// generically across every model/operation combination in the client's own
// type map, and that generic signature isn't something a hand-written
// interface can satisfy structurally without a cast at the `$extends` call
// site itself (the same reason the brief's literal code reaches for `any`
// here). This interface describes the actual shape the callback receives
// and is used instead of `any` for everything inside the function body; the
// one unavoidable `as` is on the return of `withAuditLog` itself, cast back
// to `PrismaClient`/`Prisma.TransactionClient` by callers the same way
// `db.ts` already casts `tx` when entering/leaving `withTenant`.
interface AuditOperationParams {
  model?: string;
  operation: string;
  args: Record<string, unknown>;
  query: (args: Record<string, unknown>) => Promise<unknown>;
}

// Real-gap improvement (see task-17-report.md investigation): `updateMany`/
// `createMany`/`deleteMany` return `{ count: number }`, which carries no
// `id` at all. Every `updateMany` call site on a regulated model in this
// codebase (Deviation.updateMany x3 in deviations.ts, ProductionOrder's
// TOCTOU-guarded updateMany in production.ts) targets a single row via
// `where: { id: <uuid>, ... }` — the same pattern `advanceStageInternal`
// established. Falling back to `args.where.id` recovers the real id in
// exactly those cases instead of silently losing it to `"unknown"`. This is
// intentionally narrow: it does not attempt to resolve an id out of a
// `where` clause that filters by anything other than a literal id (e.g. a
// bulk `createMany` with no `where` at all still records `"unknown"` — a
// documented MVP limitation, not solved generically here).
function extractRecordId(result: unknown, args: Record<string, unknown>): string {
  if (result && typeof result === "object" && "id" in result) {
    const id = (result as { id: unknown }).id;
    if (typeof id === "string") return id;
  }
  const where = args.where;
  if (where && typeof where === "object" && "id" in where) {
    const id = (where as { id: unknown }).id;
    if (typeof id === "string") return id;
  }
  return "unknown";
}

export function withAuditLog(prisma: PrismaClient, actorUserId: string, tenantId: string) {
  return prisma.$extends({
    name: "withAuditLog",
    query: {
      $allModels: {
        async $allOperations(params: AuditOperationParams) {
          const { model, operation, args, query } = params;
          const result = await query(args);
          if (model && REGULATED_MODELS.has(model) && WRITE_OPS.has(operation)) {
            // Runs inside the same `prisma.$transaction` callback as the
            // mutation it audits (see `withTenant` in db.ts) — if this
            // `create` throws, the whole transaction rolls back, satisfying
            // "if the audit write fails, the whole mutation must fail".
            await prisma.auditLog.create({
              data: {
                tenantId,
                tableName: model,
                recordId: extractRecordId(result, args),
                action: operation,
                afterData: result as Prisma.InputJsonValue,
                actorUserId,
                occurredAt: new Date(),
              },
            });
          }
          return result;
        },
      },
    },
  });
}
