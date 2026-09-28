import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, roleProcedure, tenantTx } from "@/lib/trpc/trpc";
import { canTransition, nextStage } from "@/lib/production/stateMachine";
import { generateOrderNumber } from "@/lib/production/generateOrderNumber";
import { createProductionOrderInput, recordWeighingInput, signInput } from "@/lib/validation/production";

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
  // Non-negotiable (Global Constraint 3, CLAUDE.md rule 3): no electronic
  // signature persists without `reauth_verified = true` and an explicit
  // `meaning_statement` — `signInput`'s `reauthVerified: z.literal(true)` +
  // `meaningStatement.min(10)` make this a Zod-level guarantee, enforced
  // before this resolver ever runs (tRPC turns a failing ZodError into a
  // TRPCError automatically). This is the pattern Task 12/13 copy for their
  // own regulated mutations — QC fail / deviation approval require normal
  // auth only, since *step-up* reauth is specific to signing (Blueprint
  // Section 8).
  //
  // Advance-stage decision (resolving the brief/blueprint discrepancy flagged
  // in this task's brief): the brief's literal Step 3 code only inserts a
  // `BatchSignature` row and never touches `ProductionOrder.status`. Taken
  // literally, that would leave the state machine with no way to reach
  // `mezclado`/`envasado`/`calidad` at all in this build order, since no
  // "record mixing"/"record packaging" mutation exists before Task 12 (QC).
  // The blueprint's own language — "Ninguna transición de etapa se persiste
  // sin firma válida" — reads as "a valid signature is what gates a stage
  // transition", not "signing is a side record with no effect". `EventTimeline.tsx`
  // (built in Task 10, before this task) already has a `case "signature"`
  // summarizer expecting a `BatchEvent` with `payload.stage`, which is a
  // second, independent signal that a `sign` call was always meant to also
  // write a `BatchEvent` — the brief's literal Step 3 code omits that too.
  // Decision: `sign` (a) verifies the order is actually at the stage being
  // signed for — the client's `stage` input is never trusted as the *source*
  // of truth, only compared against it — (b) writes the `BatchSignature` row,
  // (c) writes a `BatchEvent` (`eventType: "signature"`) so the timeline
  // reflects it, and (d) calls `advanceStageInternal` to the state machine's
  // `nextStage` of the *current* (server-read) status, when one exists.
  // `nextStage("calidad")` is `null` (see `stateMachine.ts`'s `SEQUENCE`), so
  // signing off on `calidad` intentionally does NOT auto-advance to
  // `liberado`/`rechazado` — that decision is a QC verdict, made by Task
  // 12/13's own procedures (which the brief says require normal auth, not
  // step-up), never by this generic "I did the work" attestation.
  // TODO(Task 17): audit_log write via Prisma extension — writes to two
  // regulated tables (batch_signatures, batch_events) plus a possible
  // production_orders status update; same deferral as Tasks 7-10's routers.
  sign: roleProcedure("operario", "jefe_planta", "calidad", "director_tecnico")
    .input(signInput)
    .mutation(({ ctx, input }) =>
      tenantTx(ctx, async (tx) => {
        const order = await tx.productionOrder.findUniqueOrThrow({ where: { id: input.productionOrderId } });
        if (order.status !== input.stage) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `La orden está en '${order.status}', no en '${input.stage}'`,
          });
        }

        const signature = await tx.batchSignature.create({
          data: {
            productionOrderId: input.productionOrderId,
            stage: input.stage,
            signedBy: ctx.user.id,
            meaningStatement: input.meaningStatement,
            reauthVerified: input.reauthVerified,
          },
        });

        await tx.batchEvent.create({
          data: {
            tenantId: ctx.user.tenantId,
            productionOrderId: input.productionOrderId,
            eventType: "signature",
            payload: { stage: input.stage, signatureId: signature.id },
            actorUserId: ctx.user.id,
            occurredAt: new Date(),
            clientEventId: crypto.randomUUID(),
          },
        });

        const to = nextStage(order.status);
        if (to) {
          await advanceStageInternal(tx, input.productionOrderId, to);
        }

        return signature;
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
