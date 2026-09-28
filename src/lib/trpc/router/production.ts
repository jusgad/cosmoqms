import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, roleProcedure, tenantTx } from "@/lib/trpc/trpc";
import { canTransition } from "@/lib/production/stateMachine";
import { generateOrderNumber } from "@/lib/production/generateOrderNumber";
import { createProductionOrderInput, recordWeighingInput } from "@/lib/validation/production";

export const productionRouter = router({
  // NOTE: kept the brief's literal `orderBy: { createdBy: "asc" }` (Step 7)
  // even though it reads oddly (sorting by the creator's user id rather than
  // order number/date) — it's a valid Prisma field so it typechecks, and
  // task-9-report.md flags it as a probable brief typo with no functional
  // risk, deferring the actual fix to whoever owns this file next.
  list: roleProcedure("jefe_planta", "calidad", "director_tecnico", "operario", "admin").query(({ ctx }) =>
    tenantTx(ctx, (tx) => tx.productionOrder.findMany({ orderBy: { createdBy: "asc" }, include: { formula: true } })),
  ),
  getById: roleProcedure("jefe_planta", "calidad", "director_tecnico", "operario", "admin")
    .input(z.object({ id: z.string().uuid() }))
    .query(({ ctx, input }) =>
      tenantTx(ctx, (tx) =>
        tx.productionOrder.findUniqueOrThrow({
          where: { id: input.id },
          include: { formula: true, events: { orderBy: { occurredAt: "asc" } }, signatures: true, deviations: true },
        }),
      ),
    ),
  // TODO(Task 17): audit_log write via Prisma extension — `create` writes to
  // a regulated table (production_orders) and per CLAUDE.md rule 2 must
  // record an audit_log row in the same transaction. Deferred until the
  // shared Prisma audit middleware/extension lands in Task 17; same
  // deferral as Tasks 7-8's routers.
  //
  // Non-negotiable blueprint rule (CLAUDE.md): a formula must be
  // `status === "active"` to be used in a new production order. This check
  // runs server-side against the formula read inside the same transaction —
  // never trusting the client-side select's filtering alone.
  create: roleProcedure("jefe_planta")
    .input(createProductionOrderInput)
    .mutation(({ ctx, input }) =>
      tenantTx(ctx, async (tx) => {
        const formula = await tx.masterFormula.findUniqueOrThrow({ where: { id: input.formulaId } });
        if (formula.status !== "active") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Solo formulas activas pueden usarse" });
        }
        const orderNumber = await generateOrderNumber(ctx.user.tenantId);
        return tx.productionOrder.create({
          data: {
            tenantId: ctx.user.tenantId,
            orderNumber,
            formulaId: formula.id,
            formulaVersion: formula.version,
            plannedQuantity: input.plannedQuantity,
            plannedStart: input.plannedStart ? new Date(input.plannedStart) : undefined,
            createdBy: ctx.user.id,
            status: "planificado",
          },
        });
      }),
    ),
  // Non-negotiable (CLAUDE.md rule 1): `batch_events` is append-only — this
  // procedure only ever `create`s a BatchEvent row, never updates/deletes
  // one. Non-negotiable (CLAUDE.md rule 7): the stage transition is never a
  // direct `status` write — it goes through `advanceStageInternal`, which
  // re-validates the transition server-side via `canTransition`.
  // TODO(Task 17): audit_log write via Prisma extension — this writes to two
  // regulated tables (batch_events, production_orders); same deferral as
  // Tasks 7-9's routers.
  recordWeighing: roleProcedure("operario", "jefe_planta")
    .input(recordWeighingInput)
    .mutation(({ ctx, input }) =>
      tenantTx(ctx, async (tx) => {
        await tx.batchEvent.create({
          data: {
            tenantId: ctx.user.tenantId,
            productionOrderId: input.productionOrderId,
            eventType: "weighing",
            payload: {
              rawMaterialLotId: input.rawMaterialLotId,
              theoreticalQty: input.theoreticalQty,
              actualQty: input.actualQty,
            },
            actorUserId: ctx.user.id,
            occurredAt: new Date(input.occurredAt),
            clientEventId: input.clientEventId,
          },
        });
        return advanceStageInternal(tx, input.productionOrderId, "pesado");
      }),
    ),
});

// Exported (not a public procedure) so Tasks 10-13 call it from inside their
// own `tenantTx` after writing their own regulated row (signature/QC
// result/deviation resolution) in the same transaction. Non-negotiable
// (CLAUDE.md): batch stage transitions are validated server-side as a
// strict state machine — this is the enforcement point, never trusting the
// client's reported `to` state without the `canTransition` check below.
// Type-signature note (per task-9 instructions): the brief's literal
// `Parameters<Parameters<typeof tenantTx>[1]>[0]` / `Parameters<typeof
// canTransition>[1]` were verified against the real `tenantTx`
// (src/lib/trpc/trpc.ts) and `canTransition` (src/lib/production/stateMachine.ts)
// signatures via a scratch tsc --noEmit check before adopting them here —
// they resolve to `Prisma.TransactionClient` and `BatchStatus` respectively
// and typecheck cleanly, so no deviation was needed.
export async function advanceStageInternal(
  tx: Parameters<Parameters<typeof tenantTx>[1]>[0],
  orderId: string,
  to: Parameters<typeof canTransition>[1],
) {
  const order = await tx.productionOrder.findUniqueOrThrow({ where: { id: orderId } });
  if (!canTransition(order.status, to)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `No se puede pasar de ${order.status} a ${to}` });
  }
  return tx.productionOrder.update({ where: { id: orderId }, data: { status: to } });
}
