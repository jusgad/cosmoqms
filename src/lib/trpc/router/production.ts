import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { auth } from "@clerk/nextjs/server";
import { router, roleProcedure, tenantTx } from "@/lib/trpc/trpc";
import { nextStage } from "@/lib/production/stateMachine";
import { advanceStageInternal } from "@/lib/production/advanceStage";
import { applyWeighing, assertAllIngredientsWeighed } from "@/lib/production/weighing";
import { generateOrderNumber } from "@/lib/production/generateOrderNumber";
import {
  createProductionOrderInput,
  recordWeighingInput,
  signInput,
  STAGE_SIGNER_ROLES,
} from "@/lib/validation/production";

// Tenant isolation (final review, Critical 2): every query below filters by
// `tenantId: ctx.user.tenantId` explicitly, on top of `tenantTx`'s
// `SET LOCAL app.current_tenant_id`. RLS is not applied to any live database
// yet (Task 3 blocked), so this app-level filter is the only isolation that
// actually runs today — same defense-in-depth convention Tasks 16/18
// established (`traceability.ts`, the PDF route). By-id lookups use
// `findFirst` + an explicit NOT_FOUND, so another tenant's id is
// indistinguishable from a nonexistent one.
//
// Audit (CLAUDE.md rule 2): every write on a regulated table here is audited
// by the `withAuditLog` Prisma extension applied in `withTenant` (Task 17).
export const productionRouter = router({
  // NOTE: kept the brief's literal `orderBy: { createdBy: "asc" }` (Step 7) —
  // task-9-report.md flags it as a probable brief typo with no functional risk.
  list: roleProcedure("jefe_planta", "calidad", "director_tecnico", "operario", "admin").query(({ ctx }) =>
    tenantTx(ctx, (tx) =>
      tx.productionOrder.findMany({
        where: { tenantId: ctx.user.tenantId },
        orderBy: { createdBy: "asc" },
        include: { formula: true },
      }),
    ),
  ),
  getById: roleProcedure("jefe_planta", "calidad", "director_tecnico", "operario", "admin")
    .input(z.object({ id: z.string().uuid() }))
    .query(({ ctx, input }) =>
      tenantTx(ctx, async (tx) => {
        const order = await tx.productionOrder.findFirst({
          where: { id: input.id, tenantId: ctx.user.tenantId },
          include: { formula: true, events: { orderBy: { occurredAt: "asc" } }, signatures: true, deviations: true },
        });
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Orden de producción no encontrada" });
        return order;
      }),
    ),
  // Non-negotiable blueprint rule (CLAUDE.md): a formula must be
  // `status === "active"` to be used in a new production order — checked
  // server-side against the (tenant-scoped) formula read inside the same
  // transaction, never trusting the client-side select's filtering alone.
  create: roleProcedure("jefe_planta")
    .input(createProductionOrderInput)
    .mutation(({ ctx, input }) =>
      tenantTx(ctx, async (tx) => {
        const formula = await tx.masterFormula.findFirst({
          where: { id: input.formulaId, tenantId: ctx.user.tenantId },
        });
        if (!formula) throw new TRPCError({ code: "NOT_FOUND", message: "Fórmula no encontrada" });
        if (formula.status !== "active") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Solo formulas activas pueden usarse" });
        }
        const orderNumber = await generateOrderNumber(tx, ctx.user.tenantId);
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
  // Non-negotiable (CLAUDE.md rules 1 and 7): only ever `create`s a
  // BatchEvent, and the stage transition goes through `advanceStageInternal`.
  // All lot/order validation, the server-side `theoreticalQty` and the stock
  // decrement live in `applyWeighing` (shared with `/api/sync/events`); the
  // client-sent `theoreticalQty` is accepted by the schema (the form shares
  // it) but never persisted — the server recomputes it.
  recordWeighing: roleProcedure("operario", "jefe_planta")
    .input(recordWeighingInput)
    .mutation(({ ctx, input }) =>
      tenantTx(ctx, async (tx) => {
        await applyWeighing(tx, {
          tenantId: ctx.user.tenantId,
          actorUserId: ctx.user.id,
          productionOrderId: input.productionOrderId,
          rawMaterialLotId: input.rawMaterialLotId,
          actualQty: input.actualQty,
          clientEventId: input.clientEventId,
          occurredAt: new Date(input.occurredAt),
        });
        const order = await tx.productionOrder.findFirst({
          where: { id: input.productionOrderId, tenantId: ctx.user.tenantId },
        });
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Orden de producción no encontrada" });
        return order;
      }),
    ),
  // Stage attestation (Task 11). Non-negotiable (CLAUDE.md rule 3): no
  // signature persists without `reauth_verified = true` and an explicit
  // `meaning_statement` — `signInput` guarantees both at the Zod level, and
  // Clerk's own server-side `has({ reverification: "strict" })` is re-checked
  // below because the client-sent boolean alone is not trustworthy (Task 11
  // review round 1).
  //
  // `sign` (a) verifies the order is actually at the stage being signed —
  // the client's `stage` is only compared against the server-read status,
  // never trusted as the source of truth — (b) writes the `BatchSignature`,
  // (c) writes a `signature` BatchEvent for the timeline, and (d) advances to
  // `nextStage` of the current status. `nextStage("calidad")` is `null`:
  // `liberado`/`rechazado` are decided by `qc.release`/`qc.reject`.
  //
  // Final-review fixes (Important 6):
  // - `stage` is restricted to `SIGNABLE_STAGES` (see `signInput`), so
  //   `planificado` can no longer be "signed" to skip weighing entirely.
  // - Per-stage signer roles (`STAGE_SIGNER_ROLES`): production-floor stages
  //   by `operario`/`jefe_planta`, the `calidad` stage only by
  //   `calidad`/`director_tecnico`. The procedure-level role list is the
  //   union; this narrows it per stage.
  // - Signing `pesado` requires every formula ingredient to have a weighing
  //   (`assertAllIngredientsWeighed`), not just the first one.
  sign: roleProcedure("operario", "jefe_planta", "calidad", "director_tecnico")
    .input(signInput)
    .mutation(async ({ ctx, input }) => {
      if (!STAGE_SIGNER_ROLES[input.stage].includes(ctx.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `El rol '${ctx.user.role}' no puede firmar la etapa '${input.stage}'`,
        });
      }

      const { has } = await auth();
      if (!has({ reverification: "strict" })) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Se requiere reautenticación (verificación de identidad) para firmar",
        });
      }

      return tenantTx(ctx, async (tx) => {
        const tenantId = ctx.user.tenantId;
        const order = await tx.productionOrder.findFirst({ where: { id: input.productionOrderId, tenantId } });
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Orden de producción no encontrada" });
        if (order.status !== input.stage) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `La orden está en '${order.status}', no en '${input.stage}'`,
          });
        }

        if (input.stage === "pesado") {
          await assertAllIngredientsWeighed(tx, tenantId, order);
        }

        const signature = await tx.batchSignature.create({
          data: {
            productionOrderId: order.id,
            stage: input.stage,
            signedBy: ctx.user.id,
            meaningStatement: input.meaningStatement,
            reauthVerified: input.reauthVerified,
          },
        });

        await tx.batchEvent.create({
          data: {
            tenantId,
            productionOrderId: order.id,
            eventType: "signature",
            payload: { stage: input.stage, signatureId: signature.id },
            actorUserId: ctx.user.id,
            occurredAt: new Date(),
            clientEventId: crypto.randomUUID(),
          },
        });

        const to = nextStage(order.status);
        if (to) {
          await advanceStageInternal(tx, tenantId, order.id, to);
        }

        return signature;
      });
    }),
});
