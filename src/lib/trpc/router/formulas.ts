import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, roleProcedure, tenantTx } from "@/lib/trpc/trpc";
import { sumPercentages, isWithinTolerance } from "@/lib/formulas/validateComposition";
import { createFormulaInput } from "@/lib/validation/formulas";

// Tenant isolation (final review, Critical 2): every query filters by
// `tenantId` explicitly (defense in depth while RLS is not applied to any
// live DB — see production.ts's header). `FormulaIngredient` has no
// `tenant_id` column of its own; it is scoped through its parent formula,
// which is always verified to belong to the caller's tenant first.
//
// Audit note: `master_formulas`/`formula_ingredients` are NOT among the five
// regulated tables CLAUDE.md rule 2 names (`REGULATED_MODELS` in audit.ts),
// so these writes are intentionally not written to `audit_log`.
export const formulasRouter = router({
  list: roleProcedure("jefe_planta", "calidad", "director_tecnico", "admin").query(({ ctx }) =>
    tenantTx(ctx, (tx) => tx.masterFormula.findMany({ where: { tenantId: ctx.user.tenantId }, orderBy: { name: "asc" } })),
  ),
  listActive: roleProcedure("jefe_planta", "calidad", "director_tecnico", "admin").query(({ ctx }) =>
    tenantTx(ctx, (tx) =>
      tx.masterFormula.findMany({ where: { tenantId: ctx.user.tenantId, status: "active" }, orderBy: { name: "asc" } }),
    ),
  ),
  getById: roleProcedure("jefe_planta", "calidad", "director_tecnico", "admin")
    .input(z.object({ id: z.string().uuid() }))
    .query(({ ctx, input }) =>
      tenantTx(ctx, async (tx) => {
        const formula = await tx.masterFormula.findFirst({
          where: { id: input.id, tenantId: ctx.user.tenantId },
          include: { ingredients: true },
        });
        if (!formula) throw new TRPCError({ code: "NOT_FOUND", message: "Fórmula no encontrada" });
        return formula;
      }),
    ),
  create: roleProcedure("jefe_planta")
    .input(createFormulaInput)
    .mutation(({ ctx, input }) =>
      tenantTx(ctx, (tx) => tx.masterFormula.create({ data: { ...input, tenantId: ctx.user.tenantId } })),
    ),
  // Final-review fixes:
  // - Critical 2: both client-supplied foreign keys (`formulaId`,
  //   `rawMaterialId`) are verified to belong to the caller's tenant before
  //   the ingredient row is written — otherwise a formula could be pointed at
  //   another tenant's raw material (or an ingredient attached to another
  //   tenant's formula).
  // - Important 8: ingredients can only be added while the formula is a
  //   `draft`. An `active` formula is the approved master recipe production
  //   orders are built from; changing it in place would silently alter what
  //   "version N" means (a change needs a new version, not an edit).
  addIngredient: roleProcedure("jefe_planta")
    .input(
      z.object({
        formulaId: z.string().uuid(),
        rawMaterialId: z.string().uuid(),
        percentage: z.number().positive(),
        orderIndex: z.number().int(),
      }),
    )
    .mutation(({ ctx, input }) =>
      tenantTx(ctx, async (tx) => {
        const formula = await tx.masterFormula.findFirst({
          where: { id: input.formulaId, tenantId: ctx.user.tenantId },
        });
        if (!formula) throw new TRPCError({ code: "NOT_FOUND", message: "Fórmula no encontrada" });
        if (formula.status !== "draft") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `La fórmula está en '${formula.status}' — solo se modifican fórmulas en borrador`,
          });
        }
        const rawMaterial = await tx.rawMaterial.findFirst({
          where: { id: input.rawMaterialId, tenantId: ctx.user.tenantId },
        });
        if (!rawMaterial) throw new TRPCError({ code: "NOT_FOUND", message: "Materia prima no encontrada" });
        return tx.formulaIngredient.create({ data: input });
      }),
    ),
  // Non-negotiable blueprint rule (CLAUDE.md rule 8): a formula may only
  // become `active` if its ingredients sum to 100% ± tolerance — checked
  // server-side against the ingredients read inside the same transaction.
  //
  // Final-review fix (Important 8): only a `draft` can be activated — not an
  // already-`active` one (re-activation would re-stamp `approvedBy`/
  // `approvedAt`, rewriting who approved it) nor an `archived` one. The
  // `updateMany` re-checks `status: "draft"` in its own `where` so a
  // concurrent activation/archival can't slip in between read and write.
  activate: roleProcedure("calidad")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      tenantTx(ctx, async (tx) => {
        const tenantId = ctx.user.tenantId;
        const formula = await tx.masterFormula.findFirst({
          where: { id: input.id, tenantId },
          include: { ingredients: true },
        });
        if (!formula) throw new TRPCError({ code: "NOT_FOUND", message: "Fórmula no encontrada" });
        if (formula.status !== "draft") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `La fórmula está en '${formula.status}' — solo una fórmula en borrador puede activarse`,
          });
        }
        const sum = sumPercentages(
          formula.ingredients.map((ingredient) => ({ percentage: Number(ingredient.percentage) })),
        );
        if (!isWithinTolerance(sum)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `La suma de ingredientes es ${sum}%, debe ser 100% ± tolerancia`,
          });
        }
        const { count } = await tx.masterFormula.updateMany({
          where: { id: formula.id, tenantId, status: "draft" },
          data: { status: "active", approvedBy: ctx.user.id, approvedAt: new Date() },
        });
        if (count === 0) {
          throw new TRPCError({ code: "CONFLICT", message: "La fórmula ya no está en borrador" });
        }
        return tx.masterFormula.findFirstOrThrow({ where: { id: formula.id, tenantId } });
      }),
    ),
});
