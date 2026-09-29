import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { auth } from "@clerk/nextjs/server";
import { router, roleProcedure, tenantTx } from "@/lib/trpc/trpc";
import { advanceStageInternal } from "@/lib/trpc/router/production";
import { recordResultInput, releaseInput } from "@/lib/validation/qc";

export const qcRouter = router({
  listPending: roleProcedure("calidad", "director_tecnico").query(({ ctx }) =>
    tenantTx(ctx, (tx) => tx.productionOrder.findMany({ where: { tenantId: ctx.user.tenantId, status: "calidad" } })),
  ),

  // Step 6 addition (task-12-brief.md): feeds QCResultForm.tsx's pass/fail
  // auto-derivation. `minValue`/`maxValue` are Prisma `Decimal`s — converted
  // to plain numbers here (same reasoning as pesaje/page.tsx's comment on why
  // Decimal can't cross the tRPC/Server->Client boundary as-is).
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

  recordResult: roleProcedure("calidad")
    .input(recordResultInput)
    .mutation(({ ctx, input }) =>
      tenantTx(ctx, (tx) =>
        tx.qcResult.create({
          data: { tenantId: ctx.user.tenantId, ...input, recordedBy: ctx.user.id },
        }),
      ),
    ),

  // Gap 1 + Gap 2 resolution (task-12-brief.md investigation — see that file's
  // header for the full writeup; summarized here at the enforcement point):
  //
  // Gap 2 — `release` is the blueprint's "firma final" (Section 8):
  // director_tecnico's legal release of a batch to market, the single most
  // consequential signature in the workflow. It follows `production.sign`'s
  // exact step-up pattern (Task 11): `releaseInput`'s
  // `reauthVerified: z.literal(true)` + `meaningStatement.min(10)` give the
  // Zod-level guarantee, but — same as `sign` — the client-sent boolean alone
  // is never trusted. This independently re-checks Clerk's own server-side
  // `auth().has({ reverification: "strict" })` before anything is persisted.
  release: roleProcedure("director_tecnico")
    .input(releaseInput)
    .mutation(async ({ ctx, input }) => {
      const { has } = await auth();
      if (!has({ reverification: "strict" })) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Se requiere reautenticación (verificación de identidad) para liberar el lote",
        });
      }

      return tenantTx(ctx, async (tx) => {
        // Non-negotiable (Global Constraint, brief's own correction note): a
        // QC `fail` result or any open deviation blocks release, enforced
        // with `TRPCError` (not a plain `Error`) to match the rest of the
        // codebase's error convention.
        const failing = await tx.qcResult.findMany({
          where: { tenantId: ctx.user.tenantId, productionOrderId: input.productionOrderId, result: "fail" },
        });
        if (failing.length > 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Hay resultados de QC en fail — no se puede liberar" });
        }

        const openDeviations = await tx.deviation.findMany({
          where: {
            tenantId: ctx.user.tenantId,
            productionOrderId: input.productionOrderId,
            status: { not: "cerrada" },
          },
        });
        if (openDeviations.length > 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Hay desviaciones abiertas — no se puede liberar" });
        }

        // Never a direct status write — `advanceStageInternal` re-validates
        // `calidad` -> `liberado` server-side via `canTransition` and pins
        // the write against a TOCTOU race (same as `production.sign`).
        const order = await advanceStageInternal(tx, input.productionOrderId, "liberado");

        const signature = await tx.batchSignature.create({
          data: {
            productionOrderId: input.productionOrderId,
            stage: "liberado",
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
            payload: { stage: "liberado", signatureId: signature.id },
            actorUserId: ctx.user.id,
            occurredAt: new Date(),
            clientEventId: crypto.randomUUID(),
          },
        });

        // Gap 1 — the dashboard's "lotes liberados este mes" KPI (Task 5)
        // reads `FinishedProductLot.releasedAt`, but nothing in the build
        // order up to this task ever writes that table. This is the single
        // point in the whole state machine where a batch reaches `liberado`,
        // so it's the only place this row can be created. `code` derives from
        // `order.orderNumber` (globally unique, per ProductionOrder's own
        // `@unique` — stronger than the `@@unique([tenantId, code])` this
        // table requires) since no separate lot-code field/generator exists
        // yet; a real finished-product lot numbering scheme is out of this
        // task's scope.
        const lot = await tx.finishedProductLot.create({
          data: {
            tenantId: ctx.user.tenantId,
            productionOrderId: input.productionOrderId,
            code: order.orderNumber,
            releasedBy: ctx.user.id,
            releasedAt: new Date(),
          },
        });

        return { order, signature, lot };
      });
    }),
});
