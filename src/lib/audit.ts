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

export interface AuditedClient {
  // Pass this to `.$transaction(...)` — it's `prisma` with the audit query
  // hook installed (installed before the transaction opens, since
  // `Prisma.TransactionClient` denies `$extends` — see the review round 1
  // fix note in `db.ts`).
  client: PrismaClient;
  // MUST be called with the real interactive-transaction client as the very
  // first thing inside `$transaction`'s callback, before any regulated-model
  // write runs. See the long comment on `withAuditLog` below for why this
  // exists.
  bindTransactionClient: (tx: PrismaClient) => void;
}

// Review round 2 fix (see task-17-report.md's "Fix Report: Review Round 2"
// for the full writeup, including an empirical probe against the actual
// installed @prisma/client that disproved the initially-suggested fix):
//
// The problem this solves: `$allOperations`'s hook needs to write to
// `auditLog` — a DIFFERENT model than the one whose write it's intercepting
// — using the SAME active transaction as that write, from a hook that was
// registered on the top-level `prisma` client *before* any transaction
// existed (`withTenant` in db.ts extends `prisma`, then calls
// `.$transaction(...)` on the extended client — this order is required
// because `Prisma.TransactionClient` denies `$extends`, so the hook can't be
// (re-)installed on `tx` itself).
//
// The naive fix — close over the `prisma` parameter and call
// `prisma.auditLog.create(...)` from inside the hook — runs the audit write
// against the plain, non-transactional top-level client, NOT the active
// transaction (round 1's bug fix introduced this regression; caught in
// review round 2).
//
// The *suggested* fix in round 2's finding was `Prisma.getExtensionContext(this)`
// — documented by Prisma for **client extensions** and **model extensions**
// to fetch "the client instance currently in scope, including any active
// transaction". Before applying it, this was verified empirically against
// the actual installed `@prisma/client` (6.19.3): a probe script extended a
// real `PrismaClient`, logged `this` and `Prisma.getExtensionContext(this)`
// from inside `$allModels.$allOperations`, and found `this` resolves to an
// unrelated internal array Prisma uses internally to compose chained query
// hooks (`this` had shape `[<the $allOperations function itself>]`, with no
// `auditLog` or any client-shaped property at all) — NOT the client, NOT the
// active transaction. Calling `Prisma.getExtensionContext(this).auditLog.create(...)`
// would have thrown `TypeError: Cannot read properties of undefined (reading
// 'create')` on every single regulated-model write — the same class of
// runtime crash as round 1's bug, just relocated. That documented pattern is
// specific to `client`/`model` extension methods (which Prisma types with an
// explicit `this` parameter bound to the delegate/client), not to `query`
// extensions' `$allOperations` hook, which Prisma's own type
// (`DynamicQueryExtensionCb`) declares as a plain function type with no
// `this` parameter at all — consistent with what the probe observed.
//
// The actual fix: a mutable reference cell (`auditWriter`), initialized to
// the plain `prisma` parameter, and reassigned to the REAL interactive
// transaction client via `bindTransactionClient` the instant `db.ts`'s
// `withTenant` receives it from `$transaction`'s callback — before `fn` (the
// caller's mutation) ever runs. Every `auditLog.create` call reads
// `auditWriter` at call time (not the original closured `prisma`), so once
// bound it always resolves to the SAME `tx` object the intercepted
// regulated-model write ran through. This is provably correct rather than
// dependent on undocumented `this`-binding behavior: `tx` is a real function
// parameter `withTenant` already has in hand (Prisma hands it directly to
// the `$transaction` callback), never something recovered indirectly from
// inside the hook.
export function withAuditLog(prisma: PrismaClient, actorUserId: string, tenantId: string): AuditedClient {
  let auditWriter: PrismaClient = prisma;

  const client = prisma.$extends({
    name: "withAuditLog",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const result = await query(args);
          if (model && REGULATED_MODELS.has(model) && WRITE_OPS.has(operation)) {
            // Runs inside the same `prisma.$transaction` callback as the
            // mutation it audits (see `withTenant` in db.ts) — if this
            // `create` throws, the whole transaction rolls back, satisfying
            // "if the audit write fails, the whole mutation must fail".
            await auditWriter.auditLog.create({
              data: {
                tenantId,
                tableName: model,
                recordId: extractRecordId(result, args as Record<string, unknown>),
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
  }) as unknown as PrismaClient;

  return {
    client,
    bindTransactionClient: (tx) => {
      auditWriter = tx;
    },
  };
}
