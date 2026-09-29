import { TRPCError } from "@trpc/server";
import { router, roleProcedure, tenantTx } from "@/lib/trpc/trpc";
import { createDeviationInput, investigateDeviationInput, approveDeviationInput } from "@/lib/validation/deviations";
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
// 2) `investigate` skipping `en_investigacion` — kept as the brief's literal
//    single-step "submit investigation + corrective action for approval"
//    action (open -> pendiente_aprobacion in one call), for two reasons:
//    (a) nothing downstream (Task 12's `qc.release` guard only ever checks
//    `status !== "cerrada"`) reads or depends on `en_investigacion` as an
//    intermediate state, so a separate "start investigation" mutation would
//    add a state transition with no consumer in this build order; (b) the
//    blueprint's 5-step flow ("detección -> investigación -> acción
//    correctiva/preventiva -> aprobación -> cierre") describes the
//    *documentation* content of a single investigation record (what
//    happened, what corrective action was taken), not necessarily two
//    separate button-clicks by `calidad` — one submission that carries both
//    the investigation narrative and the corrective action is a defensible
//    MVP simplification. `en_investigacion` remains a valid schema value
//    (e.g. for a future "mark as being worked on" UI affordance) — the
//    `investigate` mutation's TOCTOU-guarded `where` clause below accepts a
//    deviation starting from either `abierta` OR `en_investigacion`, so nothing
//    is precluded if a later task adds that intermediate step.
export const deviationsRouter = router({
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

  // Single-step submission (see file header, point 2): documents the
  // investigation + corrective action and moves straight to
  // `pendiente_aprobacion`. TOCTOU-guarded the same way
  // `production.ts`'s `advanceStageInternal` pins `ProductionOrder.status`:
  // the `updateMany`'s `where` re-checks `status` is still one of the two
  // valid starting states, so two concurrent submissions (or a resubmission
  // after approval) can't silently clobber each other.
  investigate: roleProcedure("calidad")
    .input(investigateDeviationInput)
    .mutation(({ ctx, input }) =>
      tenantTx(ctx, async (tx) => {
        const { count } = await tx.deviation.updateMany({
          where: {
            id: input.id,
            tenantId: ctx.user.tenantId,
            status: { in: ["abierta", "en_investigacion"] },
          },
          data: {
            investigation: input.investigation,
            correctiveAction: input.correctiveAction,
            status: "pendiente_aprobacion",
          },
        });
        if (count === 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "La desviación no está en un estado que permita registrar la investigación",
          });
        }
        return tx.deviation.findUniqueOrThrow({ where: { id: input.id } });
      }),
    ),

  // Non-negotiable (task brief + global constraints): approval of a
  // deviation's CAPA is server-gated to `director_tecnico` via `roleProcedure`
  // — this is the actual enforcement boundary; any client-side gate (the
  // "Aprobar" button in DeviationForm.tsx) is a UX convenience only, per the
  // `qc.release` precedent (Task 12). Same TOCTOU pattern as `investigate`:
  // only a deviation still `pendiente_aprobacion` can be approved.
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
