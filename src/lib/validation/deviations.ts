import { z } from "zod";

// Schema-only module: intentionally has zero dependency on `@/lib/trpc/trpc`
// or `@/lib/db` (which instantiates `PrismaClient` at module top level).
// DeviationForm.tsx (a Client Component) imports this directly so that its
// bundle never pulls Prisma into the browser — the Task 7 incident this
// guards against, and src/lib/validation/qc.ts for the established precedent.
export const createDeviationInput = z.object({
  productionOrderId: z.string().uuid(),
  description: z.string().min(10, "Describa la desviación con al menos 10 caracteres"),
});

export type CreateDeviationValues = z.infer<typeof createDeviationInput>;

// See deviations.ts (task-13-brief.md investigation) for why `investigate`
// is a single step (open -> submit investigation + corrective action ->
// pendiente_aprobacion) rather than a separate "start investigation" call.
export const investigateDeviationInput = z.object({
  id: z.string().uuid(),
  investigation: z.string().min(10, "Documente la investigación con al menos 10 caracteres"),
  correctiveAction: z.string().min(10, "Documente la acción correctiva con al menos 10 caracteres"),
});

export type InvestigateDeviationValues = z.infer<typeof investigateDeviationInput>;

export const approveDeviationInput = z.object({
  id: z.string().uuid(),
});

export type ApproveDeviationValues = z.infer<typeof approveDeviationInput>;
