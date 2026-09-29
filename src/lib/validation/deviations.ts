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

// Task 13 review round 1 (Sebas's decision): the investigation is now a
// TWO-step flow for audit-trail granularity — `startInvestigation` (no body
// beyond the id) marks who/when the investigation began (`abierta ->
// en_investigacion`), and `submitInvestigation` (below) records the
// documentation and moves to `pendiente_aprobacion`. See deviations.ts for
// the full reasoning.
export const startInvestigationInput = z.object({
  id: z.string().uuid(),
});

export type StartInvestigationValues = z.infer<typeof startInvestigationInput>;

export const submitInvestigationInput = z.object({
  id: z.string().uuid(),
  investigation: z.string().min(10, "Documente la investigación con al menos 10 caracteres"),
  correctiveAction: z.string().min(10, "Documente la acción correctiva con al menos 10 caracteres"),
});

export type SubmitInvestigationValues = z.infer<typeof submitInvestigationInput>;

export const approveDeviationInput = z.object({
  id: z.string().uuid(),
});

export type ApproveDeviationValues = z.infer<typeof approveDeviationInput>;
