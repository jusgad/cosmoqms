import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, roleProcedure, tenantTx } from "@/lib/trpc/trpc";
import { sumPercentages, isWithinTolerance } from "@/lib/formulas/validateComposition";
import { createFormulaInput } from "@/lib/validation/formulas";

export const formulasRouter = router({
  list: roleProcedure("jefe_planta", "calidad", "director_tecnico", "admin").query(({ ctx }) =>
    tenantTx(ctx, (tx) => tx.masterFormula.findMany({ orderBy: { name: "asc" } })),
  ),
  listActive: roleProcedure("jefe_planta", "calidad", "director_tecnico", "admin").query(({ ctx }) =>
    tenantTx(ctx, (tx) => tx.masterFormula.findMany({ where: { status: "active" }, orderBy: { name: "asc" } })),
  ),
  getById: roleProcedure("jefe_planta", "calidad", "director_tecnico", "admin")
    .input(z.object({ id: z.string().uuid() }))
    .query(({ ctx, input }) =>
      tenantTx(ctx, (tx) =>
        tx.masterFormula.findUniqueOrThrow({ where: { id: input.id }, include: { ingredients: true } }),
      ),
    ),
  // TODO(Task 17): audit_log write via Prisma extension — `create` writes to
  // a regulated table (master_formulas) and per CLAUDE.md rule 2 must record
  // an audit_log row in the same transaction. Deferred until the shared
  // Prisma audit middleware/extension lands in Task 17; same deferral as
  // Task 7's materials router.
  create: roleProcedure("jefe_planta")
    .input(createFormulaInput)
    .mutation(({ ctx, input }) =>
      tenantTx(ctx, (tx) => tx.masterFormula.create({ data: { ...input, tenantId: ctx.user.tenantId } })),
    ),
  // TODO(Task 17): audit_log write via Prisma extension — `addIngredient`
  // writes to a regulated table (formula_ingredients); same deferral as above.
  addIngredient: roleProcedure("jefe_planta")
    .input(
      z.object({
        formulaId: z.string().uuid(),
        rawMaterialId: z.string().uuid(),
        percentage: z.number().positive(),
        orderIndex: z.number().int(),
      }),
    )
    .mutation(({ ctx, input }) => tenantTx(ctx, (tx) => tx.formulaIngredient.create({ data: input }))),
  // TODO(Task 17): audit_log write via Prisma extension — `activate` writes
  // to a regulated table (master_formulas); same deferral as above.
  //
  // Non-negotiable blueprint rule (CLAUDE.md): a formula may only become
  // `active` if its ingredients sum to 100% ± tolerance. This check runs
  // server-side against the ingredients read inside the same transaction —
  // never trusting a client-submitted "looks like 100%" claim.
  activate: roleProcedure("calidad")
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      tenantTx(ctx, async (tx) => {
        const formula = await tx.masterFormula.findUniqueOrThrow({
          where: { id: input.id },
          include: { ingredients: true },
        });
        const sum = sumPercentages(
          formula.ingredients.map((ingredient) => ({ percentage: Number(ingredient.percentage) })),
        );
        if (!isWithinTolerance(sum)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `La suma de ingredientes es ${sum}%, debe ser 100% ± tolerancia`,
          });
        }
        return tx.masterFormula.update({
          where: { id: input.id },
          data: { status: "active", approvedBy: ctx.user.id, approvedAt: new Date() },
        });
      }),
    ),
});
