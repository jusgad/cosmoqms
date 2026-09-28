import { z } from "zod";

// Schema-only module: intentionally has zero dependency on `@/lib/trpc/trpc`
// or `@/lib/db` (which instantiates `PrismaClient` at module top level).
// NuevaOrdenForm.tsx (a Client Component) imports this directly so that its
// bundle never pulls Prisma into the browser — the Task 7 incident this
// guards against, and src/lib/validation/formulas.ts / materials.ts for the
// established precedent.
export const createProductionOrderInput = z.object({
  formulaId: z.string().uuid(),
  plannedQuantity: z.number().positive(),
  plannedStart: z.string().optional(),
});

export type CreateProductionOrderValues = z.infer<typeof createProductionOrderInput>;

// Shared with WeighingForm.tsx (Task 10, Client Component) for the exact
// same bundle-safety reason documented above — the form imports this schema
// directly, never the router file.
export const recordWeighingInput = z.object({
  productionOrderId: z.string().uuid(),
  rawMaterialLotId: z.string().uuid(),
  theoreticalQty: z.number().positive(),
  actualQty: z.number().positive(),
  clientEventId: z.string().uuid(),
  occurredAt: z.string(),
});

export type RecordWeighingValues = z.infer<typeof recordWeighingInput>;

// Shared with SignaturePad.tsx (Task 11, Client Component) for the exact
// same bundle-safety reason documented above. `reauthVerified` is a
// `z.literal(true)` — matches Global Constraint 3 ("Ninguna firma
// electrónica se persiste sin reauth_verified = true y meaning_statement
// explícito") at the Zod level, not just by convention: no falsy-adjacent
// value can satisfy it.
export const signInput = z.object({
  productionOrderId: z.string().uuid(),
  stage: z.string().min(1),
  meaningStatement: z.string().min(10, "La declaración de significado es obligatoria"),
  reauthVerified: z.literal(true, { error: "Se requiere reautenticación" }),
});

export type SignValues = z.infer<typeof signInput>;

// Read-only meaning-statement template per stage, shown in SignaturePad
// before the operator signs. Keys are the `BatchStatus` values that
// represent a *completed* stage being attested to (never "planificado",
// which has nothing to confirm, and never the terminal "liberado"/
// "rechazado", which are QC decisions made by Task 12/13's own procedures).
export const SIGNATURE_MEANING_STATEMENTS: Record<string, string> = {
  pesado: "Confirmo que realicé el pesaje conforme a la fórmula maestra",
  mezclado: "Confirmo que realicé el mezclado conforme al proceso",
  envasado: "Confirmo que realicé el envasado conforme al proceso",
  calidad: "Confirmo la validación de calidad de este lote",
};
