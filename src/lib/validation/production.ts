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
