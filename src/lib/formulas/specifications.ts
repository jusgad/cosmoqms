import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { normalizeParameter } from "@/lib/quality/evaluateSpec";
import type { QcSpecificationValues } from "@/lib/validation/formulas";

// Quality specifications of a master formula, maintained by `calidad`.
// Like its ingredients, a formula's specifications are part of the approved
// recipe: they can only change while the formula is a `draft`. Changing the
// acceptance criteria of an `active` formula in place would silently alter
// how every future batch of "version N" is judged — that needs a new version.
// Every query filters by `tenantId` explicitly (defense in depth on top of RLS).

function notDraft(status: string): TRPCError {
  return new TRPCError({
    code: "BAD_REQUEST",
    message: `La fórmula está en '${status}': las especificaciones solo se pueden cambiar en una fórmula en borrador`,
  });
}

export async function addSpecification(tx: Prisma.TransactionClient, tenantId: string, input: QcSpecificationValues) {
  const formula = await tx.masterFormula.findFirst({ where: { id: input.formulaId, tenantId } });
  if (!formula) throw new TRPCError({ code: "NOT_FOUND", message: "Fórmula no encontrada" });
  if (formula.status !== "draft") throw notDraft(formula.status);

  const existing = await tx.qcSpecification.findMany({ where: { tenantId, formulaId: formula.id } });
  const wanted = normalizeParameter(input.parameter);
  if (existing.some((spec) => normalizeParameter(spec.parameter) === wanted)) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `La fórmula ya tiene una especificación para '${input.parameter}'`,
    });
  }

  return tx.qcSpecification.create({
    data: {
      tenantId,
      formulaId: formula.id,
      parameter: input.parameter,
      minValue: input.minValue ?? null,
      maxValue: input.maxValue ?? null,
      unit: input.unit || null,
    },
  });
}

export async function removeSpecification(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  const spec = await tx.qcSpecification.findFirst({ where: { id, tenantId }, include: { formula: true } });
  if (!spec) throw new TRPCError({ code: "NOT_FOUND", message: "Especificación no encontrada" });
  if (spec.formula.status !== "draft") throw notDraft(spec.formula.status);
  await tx.qcSpecification.deleteMany({ where: { id, tenantId } });
  return { id };
}
