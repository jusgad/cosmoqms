import { z } from "zod";

// Schema-only module: intentionally has zero dependency on `@/lib/trpc/trpc`
// or `@/lib/db` (which instantiates `PrismaClient` at module top level).
// FormulaForm.tsx (a Client Component) imports these directly so that its
// bundle never pulls Prisma into the browser. See task-7-report.md,
// "Fix report — round 1" for the incident this guards against, and
// src/lib/validation/materials.ts for the precedent.
export const createFormulaInput = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  productType: z.string().optional(),
});

export const formulaIngredientInput = z.object({
  rawMaterialId: z.string().uuid(),
  percentage: z.number().positive(),
});

export type CreateFormulaValues = z.infer<typeof createFormulaInput>;
export type FormulaIngredientValues = z.infer<typeof formulaIngredientInput>;

// A quality specification of a formula (e.g. pH 5.5–7). At least one bound is
// required, and when both are given the range must not be inverted. The
// server re-validates the same schema, so the form can never store a spec
// that QC results could not be evaluated against.
export const qcSpecificationInput = z
  .object({
    formulaId: z.string().uuid(),
    parameter: z.string().trim().min(1, "El parámetro es obligatorio").max(60),
    minValue: z.number().finite().optional(),
    maxValue: z.number().finite().optional(),
    unit: z.string().trim().max(16).optional(),
  })
  .refine((value) => value.minValue !== undefined || value.maxValue !== undefined, {
    message: "Indique al menos el mínimo o el máximo",
    path: ["minValue"],
  })
  .refine(
    (value) => value.minValue === undefined || value.maxValue === undefined || value.minValue <= value.maxValue,
    { message: "El mínimo no puede ser mayor que el máximo", path: ["maxValue"] },
  );

export type QcSpecificationValues = z.infer<typeof qcSpecificationInput>;
