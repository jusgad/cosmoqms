import { TRPCError } from "@trpc/server";
import { router, roleProcedure, tenantTx } from "@/lib/trpc/trpc";
import {
  createDeviationInput,
  startInvestigationInput,
  submitInvestigationInput,
  approveDeviationInput,
} from "@/lib/validation/deviations";
import { z } from "zod";

// Design investigation (task-13-brief.md's own header flags this as a real
// gap to resolve, not a rubber-stamp of the brief's literal code):
//
// 1) `approve` vs `close` — the brief's literal Step 3 exposes BOTH, and both
//    just set `status: "cerrada"` (`approve` additionally stamps
//    `approvedBy`/`approvedAt`). The schema's `DeviationStatus` enum
//    (`abierta`, `en_investigacion`, `pendiente_aprobacion`, `cerrada`) has
//    exactly ONE terminal state — there is no separate "aprobada" state for
//    `approve` to land on before some later, distinct "cerrada" transition.
//    Given that, `close` cannot serve the "closing a deviation that turned
//    out not to need CAPA" purpose either: a director_tecnico who decides no
//    CAPA is needed still has nothing to reach `cerrada` through except the
//    exact same one-argument mutation `approve` already is. Exposing a
//    second procedure that performs an identical write for a
//    role-and-arguments-identical call is dead API surface, not a
//    distinct workflow step — so `close` is DROPPED from this router. If a
//    future task adds an `aprobada` (approved-but-not-yet-closed) enum value
//    to the schema, that is the point to reintroduce a genuinely distinct
//    `close` step; today it would be untestable dead code, which the brief's
//    own investigation prompt warns against.
//
// 2) `investigate` (originally a single step) — REVISED in task 13 review
//    round 1 per Sebas's explicit decision: split into `startInvestigation`
//    (`abierta -> en_investigacion`, records who/when investigation began)
//    and `submitInvestigation` (`en_investigacion -> pendiente_aprobacion`,
//    records the investigation narrative + corrective action). The original
//    single-step version silently discarded exactly the audit-trail signal
//    `en_investigacion` exists to provide — when investigation actually
//    started and who started it — which matters for INVIMA audit review, so
//    the two-step flow is the correct design, not just an alternative one.
//    `Deviation.investigationStartedBy`/`investigationStartedAt` (added to
//    the schema in this round) persist that moment; `schema.prisma`'s own
//    comment documents why this was edited directly rather than via
//    `prisma migrate dev` (Task 3/live DB still BLOCKED — same precedent as
//    commit a2146d2's `@@unique([productionOrderId, stage])`).
export const deviationsRouter = router({
  // Not called from any Client Component — `desviaciones/page.tsx` and
  // `[id]/page.tsx` read Prisma directly instead (CLAUDE.md's Data Flow
  // rule: "Server Components leen directo de Prisma para listados/reportes",
  // same as `qc.listPending`'s own precedent). Kept on the router for API
  // completeness/testability (e.g. a future mobile client or offline sync
  // consumer), same reasoning `qc.listPending` documents.
  list: roleProcedure("calidad", "director_tecnico", "jefe_planta", "operario").query(({ ctx }) =>
    tenantTx(ctx, (tx) =>
      tx.deviation.findMany({
        where: { tenantId: ctx.user.tenantId, status: { not: "cerrada" } },
        orderBy: { id: "asc" },
      }),
    ),
  ),

  getById: roleProcedure("calidad", "director_tecnico", "jefe_planta", "operario")
    .input(z.object({ id: z.string().uuid() }))
    .query(({ ctx, input }) =>
      tenantTx(ctx, (tx) => tx.deviation.findUniqueOrThrow({ where: { id: input.id } })),
    ),

  create: roleProcedure("calidad", "jefe_planta", "operario")
    .input(createDeviationInput)
    .mutation(({ ctx, input }) =>
      tenantTx(ctx, (tx) =>
        tx.deviation.create({
          data: { tenantId: ctx.user.tenantId, ...input, raisedBy: ctx.user.id, status: "abierta" },
        }),
      ),
    ),

  // Step 1 of 2 (task 13 review round 1, Sebas's decision): marks who/when
  // the investigation actually started — `abierta -> en_investigacion` only,
  // no documentation content yet. TOCTOU-guarded the same way
  // `production.ts`'s `advanceStageInternal` pins `ProductionOrder.status`:
  // the `updateMany`'s `where` re-checks the deviation is still `abierta`,
  // so two `calidad` users racing to start the same investigation can't both
  // "win" silently (the second gets CONFLICT).
  startInvestigation: roleProcedure("calidad")
    .input(startInvestigationInput)
    .mutation(({ ctx, input }) =>
      tenantTx(ctx, async (tx) => {
        const { count } = await tx.deviation.updateMany({
          where: { id: input.id, tenantId: ctx.user.tenantId, status: "abierta" },
          data: {
            status: "en_investigacion",
            investigationStartedBy: ctx.user.id,
            investigationStartedAt: new Date(),
          },
        });
        if (count === 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "La desviación no está en estado 'abierta'",
          });
        }
        return tx.deviation.findUniqueOrThrow({ where: { id: input.id } });
      }),
    ),

  // Step 2 of 2: documents the investigation + corrective action and moves
  // to `pendiente_aprobacion`. Requires the deviation to already be
  // `en_investigacion` (i.e. `startInvestigation` must have run first) —
  // same TOCTOU-guarded `updateMany` pattern as `startInvestigation`/
  // `approve` below.
  submitInvestigation: roleProcedure("calidad")
    .input(submitInvestigationInput)
    .mutation(({ ctx, input }) =>
      tenantTx(ctx, async (tx) => {
        const { count } = await tx.deviation.updateMany({
          where: { id: input.id, tenantId: ctx.user.tenantId, status: "en_investigacion" },
          data: {
            investigation: input.investigation,
            correctiveAction: input.correctiveAction,
            status: "pendiente_aprobacion",
          },
        });
        if (count === 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "La desviación no está en estado 'en_investigacion' — inicie la investigación primero",
          });
        }
        return tx.deviation.findUniqueOrThrow({ where: { id: input.id } });
      }),
    ),

  // Non-negotiable (task brief + global constraints): approval of a
  // deviation's CAPA is server-gated to `director_tecnico` via `roleProcedure`
  // — this is the actual enforcement boundary; any client-side gate (the
  // "Aprobar" button in DeviationForm.tsx) is a UX convenience only, per the
  // `qc.release` precedent (Task 12). Same TOCTOU pattern as
  // `startInvestigation`/`submitInvestigation`: only a deviation still
  // `pendiente_aprobacion` can be approved.
  approve: roleProcedure("director_tecnico")
    .input(approveDeviationInput)
    .mutation(({ ctx, input }) =>
      tenantTx(ctx, async (tx) => {
        const { count } = await tx.deviation.updateMany({
          where: { id: input.id, tenantId: ctx.user.tenantId, status: "pendiente_aprobacion" },
          data: { status: "cerrada", approvedBy: ctx.user.id, approvedAt: new Date() },
        });
        if (count === 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "La desviación no está pendiente de aprobación",
          });
        }
        return tx.deviation.findUniqueOrThrow({ where: { id: input.id } });
      }),
    ),
});
