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
