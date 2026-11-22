import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

// Formula change control. An `active` formula is the approved master recipe
// production orders are built from, so it is never edited in place: a change
// is a NEW VERSION — a draft copied from the active one (ingredients and QC
// specifications), edited, and activated by quality. Activating version N+1
// archives version N in the same transaction, so there is only ever one
// active version per code; orders keep the version they were made with
// (`production_orders.formula_version`). Every query filters by `tenantId`.

function badRequest(message: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

export async function createNewVersion(tx: Prisma.TransactionClient, tenantId: string, formulaId: string) {
  const source = await tx.masterFormula.findFirst({
    where: { id: formulaId, tenantId },
    include: { ingredients: { orderBy: { orderIndex: "asc" } }, qcSpecifications: true },
  });
  if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "Fórmula no encontrada" });
  if (source.status !== "active") badRequest("Solo se crea una nueva versión a partir de la versión activa");

  const draft = await tx.masterFormula.findFirst({ where: { tenantId, code: source.code, status: "draft" } });
  if (draft) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Ya existe un borrador (versión ${draft.version}) de ${source.code}: termínelo o pida a calidad que lo active`,
    });
  }

  const latest = await tx.masterFormula.findFirst({
    where: { tenantId, code: source.code },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const created = await tx.masterFormula.create({
    data: {
      tenantId,
      code: source.code,
      name: source.name,
      productType: source.productType,
      version: (latest?.version ?? source.version) + 1,
      status: "draft",
      ingredients: {
        create: source.ingredients.map((ingredient) => ({
          rawMaterialId: ingredient.rawMaterialId,
          percentage: ingredient.percentage,
          orderIndex: ingredient.orderIndex,
        })),
      },
    },
  });
  for (const spec of source.qcSpecifications) {
    await tx.qcSpecification.create({
      data: {
        tenantId,
        formulaId: created.id,
        parameter: spec.parameter,
        minValue: spec.minValue,
        maxValue: spec.maxValue,
        unit: spec.unit,
      },
    });
  }
  return created;
}

// Called by `formulas.activate` right after a draft becomes active.
export async function archiveOtherActiveVersions(
  tx: Prisma.TransactionClient,
  tenantId: string,
  formula: { id: string; code: string },
): Promise<number> {
  const { count } = await tx.masterFormula.updateMany({
    where: { tenantId, code: formula.code, status: "active", id: { not: formula.id } },
    data: { status: "archived" },
  });
  return count;
}

async function draftIngredient(tx: Prisma.TransactionClient, tenantId: string, ingredientId: string) {
  const ingredient = await tx.formulaIngredient.findFirst({
    where: { id: ingredientId, formula: { tenantId } },
    include: { formula: true },
  });
  if (!ingredient) throw new TRPCError({ code: "NOT_FOUND", message: "Ingrediente no encontrado" });
  if (ingredient.formula.status !== "draft") {
    badRequest(`La fórmula está en '${ingredient.formula.status}' — solo se modifican fórmulas en borrador`);
  }
  return ingredient;
}

export async function updateIngredientPercentage(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ingredientId: string,
  percentage: number,
) {
  const ingredient = await draftIngredient(tx, tenantId, ingredientId);
  return tx.formulaIngredient.update({ where: { id: ingredient.id }, data: { percentage } });
}

export async function removeIngredient(tx: Prisma.TransactionClient, tenantId: string, ingredientId: string) {
  const ingredient = await draftIngredient(tx, tenantId, ingredientId);
  await tx.formulaIngredient.delete({ where: { id: ingredient.id } });
  return { id: ingredient.id };
}
