import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { assertReverified } from "@/lib/reauth";
import { router, roleProcedure, tenantTx } from "@/lib/trpc/trpc";
import { advanceStageInternal } from "@/lib/production/advanceStage";
import { recordResultInput, rejectInput, releaseInput } from "@/lib/validation/qc";
import { evaluateAgainstSpec, normalizeParameter } from "@/lib/quality/evaluateSpec";
import { notifyAudience } from "@/lib/notifications/notify";
import { deliverEmails } from "@/lib/notifications/deliver";

// Writes the final-decision signature + its timeline event. Shared by
// `release` (stage `liberado`) and `reject` (stage `rechazado`).
async function recordDecisionSignature(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    userId: string;
    productionOrderId: string;
    stage: "liberado" | "rechazado";
    meaningStatement: string;
    reauthVerified: true;
  },
) {
  const signature = await tx.batchSignature.create({
    data: {
      productionOrderId: params.productionOrderId,
      stage: params.stage,
      signedBy: params.userId,
      meaningStatement: params.meaningStatement,
      reauthVerified: params.reauthVerified,
    },
  });
  await tx.batchEvent.create({
    data: {
      tenantId: params.tenantId,
      productionOrderId: params.productionOrderId,
      eventType: "signature",
      payload: { stage: params.stage, signatureId: signature.id },
      actorUserId: params.userId,
      occurredAt: new Date(),
      clientEventId: crypto.randomUUID(),
    },
  });
  return signature;
}

export const qcRouter = router({
  listPending: roleProcedure("calidad", "director_tecnico").query(({ ctx }) =>
    tenantTx(ctx, (tx) => tx.productionOrder.findMany({ where: { tenantId: ctx.user.tenantId, status: "calidad" } })),
  ),

  // Feeds QCResultForm.tsx's pass/fail auto-derivation. `Decimal` bounds are
  // converted to plain numbers (can't cross the tRPC boundary as-is).
  specsForFormula: roleProcedure("calidad", "director_tecnico")
    .input(z.object({ formulaId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      tenantTx(ctx, async (tx) => {
        const specs = await tx.qcSpecification.findMany({
          where: { tenantId: ctx.user.tenantId, formulaId: input.formulaId },
        });
        return specs.map((spec) => ({
          id: spec.id,
          parameter: spec.parameter,
          minValue: spec.minValue === null ? null : Number(spec.minValue),
          maxValue: spec.maxValue === null ? null : Number(spec.maxValue),
          unit: spec.unit,
        }));
      }),
    ),

  // Final-review fixes (Critical 2 + Important 5): the target order must
  // belong to the caller's tenant (a client-supplied `productionOrderId` is
  // never trusted as-is) AND be in `calidad` — QC results recorded against a
  // batch still in production, or one already released/rejected, would
  // corrupt the batch record the release decision is based on.
  //
  // The verdict is the server's: when the formula has a specification for
  // this parameter, `result` is recomputed from it and the client's value is
  // ignored (CLAUDE.md rule 7). Only a parameter with no specification at all
  // keeps the submitted verdict. A `fail` notifies quality and the plant.
  recordResult: roleProcedure("calidad")
    .input(recordResultInput)
    .mutation(async ({ ctx, input }) => {
      const { qcResult, emails } = await tenantTx(ctx, async (tx) => {
        const tenantId = ctx.user.tenantId;
        const order = await tx.productionOrder.findFirst({
          where: { id: input.productionOrderId, tenantId },
        });
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Orden de producción no encontrada" });
        if (order.status !== "calidad") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `La orden está en '${order.status}' — solo se registran resultados de QC en 'calidad'`,
          });
        }

        const specs = await tx.qcSpecification.findMany({ where: { tenantId, formulaId: order.formulaId } });
        const spec = specs.find((item) => normalizeParameter(item.parameter) === normalizeParameter(input.parameter));
        const result = spec
          ? evaluateAgainstSpec(input.measuredValue, {
              minValue: spec.minValue === null ? null : Number(spec.minValue),
              maxValue: spec.maxValue === null ? null : Number(spec.maxValue),
            })
          : input.result;

        const created = await tx.qcResult.create({
          data: { tenantId, ...input, result, recordedBy: ctx.user.id },
        });

        const pending =
          result === "fail"
            ? await notifyAudience(tx, {
                tenantId,
                actorUserId: ctx.user.id,
                draft: {
                  kind: "qc_fuera_de_especificacion",
                  title: `QC fuera de especificación en ${order.orderNumber}`,
                  body: spec
                    ? `${input.parameter}: ${input.measuredValue}${spec.unit ? ` ${spec.unit}` : ""} (rango ${spec.minValue ?? "—"} a ${spec.maxValue ?? "—"}).`
                    : `${input.parameter}: ${input.measuredValue} registrado como no conforme.`,
                  link: `/produccion/${order.id}`,
                },
              })
            : [];
        return { qcResult: created, emails: pending };
      });
      await deliverEmails(emails, ctx.user.id);
      return qcResult;
    }),

  // `release` is the blueprint's "firma final" (Section 8): director_tecnico's
  // legal release of a batch to market. Same step-up pattern as
  // `production.sign`. Release is blocked by (Task 12) any QC `fail` or any
  // open deviation, and (final review, Important 5) by missing QC:
  //   - at least one QC result must exist — zero results used to pass, since
  //     the only check was "no fail results";
  //   - if the formula has `QcSpecification` rows, EVERY specified parameter
  //     must have at least one result. Spec parameters are free text, so the
  //     match is case/whitespace-insensitive.
  release: roleProcedure("director_tecnico")
    .input(releaseInput)
    .mutation(async ({ ctx, input }) => {
      await assertReverified("liberar el lote");

      return tenantTx(ctx, async (tx) => {
        const tenantId = ctx.user.tenantId;
        const current = await tx.productionOrder.findFirst({ where: { id: input.productionOrderId, tenantId } });
        if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Orden de producción no encontrada" });

        const results = await tx.qcResult.findMany({
          where: { tenantId, productionOrderId: current.id },
        });
        if (results.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No hay resultados de QC registrados — no se puede liberar" });
        }
        if (results.some((r) => r.result === "fail")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Hay resultados de QC en fail — no se puede liberar" });
        }

        const specs = await tx.qcSpecification.findMany({
          where: { tenantId, formulaId: current.formulaId },
        });
        const measured = new Set(results.map((r) => normalizeParameter(r.parameter)));
        const missing = specs.filter((spec) => !measured.has(normalizeParameter(spec.parameter)));
        if (missing.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Faltan resultados de QC para: ${missing.map((spec) => spec.parameter).join(", ")}`,
          });
        }

        const openDeviations = await tx.deviation.findMany({
          where: { tenantId, productionOrderId: current.id, status: { not: "cerrada" } },
        });
        if (openDeviations.length > 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Hay desviaciones abiertas — no se puede liberar" });
        }

        // Never a direct status write — `canTransition` re-validates
        // `calidad -> liberado` and the write is TOCTOU-pinned.
        const order = await advanceStageInternal(tx, tenantId, current.id, "liberado");

        const signature = await recordDecisionSignature(tx, {
          tenantId,
          userId: ctx.user.id,
          productionOrderId: order.id,
          stage: "liberado",
          meaningStatement: input.meaningStatement,
          reauthVerified: input.reauthVerified,
        });

        // The only point in the state machine where a batch reaches
        // `liberado`, so the only place this row (the dashboard's "lotes
        // liberados" KPI source) can be created. `code` reuses
        // `order.orderNumber`, which is unique PER TENANT
        // (`@@unique([tenantId, orderNumber])`, final review Critical 1) —
        // exactly the scope of this table's own `@@unique([tenantId, code])`.
        const lot = await tx.finishedProductLot.create({
          data: {
            tenantId,
            productionOrderId: order.id,
            code: order.orderNumber,
            releasedBy: ctx.user.id,
            releasedAt: new Date(),
          },
        });

        return { order, signature, lot };
      });
    }),

  // Final-review fix (Important 4): `canTransition("calidad", "rechazado")`
  // existed but nothing ever called it, so a batch failing QC had no way to
  // be closed out. Gated to `director_tecnico` — the same authority that
  // releases (Blueprint: director_tecnico owns the final batch decision) —
  // with the same step-up reauth + meaning statement as `release`, since a
  // rejection is an equally binding signature. Deliberately NO QC/deviation
  // preconditions: a batch can be rejected precisely BECAUSE QC failed or a
  // deviation is unresolved. No FinishedProductLot is created.
  reject: roleProcedure("director_tecnico")
    .input(rejectInput)
    .mutation(async ({ ctx, input }) => {
      await assertReverified("rechazar el lote");

      return tenantTx(ctx, async (tx) => {
        const tenantId = ctx.user.tenantId;
        const order = await advanceStageInternal(tx, tenantId, input.productionOrderId, "rechazado");
        const signature = await recordDecisionSignature(tx, {
          tenantId,
          userId: ctx.user.id,
          productionOrderId: order.id,
          stage: "rechazado",
          meaningStatement: input.meaningStatement,
          reauthVerified: input.reauthVerified,
        });
        return { order, signature };
      });
    }),
});
