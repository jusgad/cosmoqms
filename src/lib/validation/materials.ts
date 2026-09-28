import { z } from "zod";

// Schema-only module: intentionally has zero dependency on `@/lib/trpc/trpc`
// or `@/lib/db` (which instantiates `PrismaClient` at module top level).
// Client Components (e.g. ReceiveLotForm.tsx) import this directly so that
// their bundle never pulls Prisma into the browser. See task-7-report.md,
// "Fix report — round 1" for the incident this guards against.
export const receiveLotInput = z.object({
  rawMaterialId: z.string().uuid(),
  supplierLotCode: z.string().min(1),
  supplierProvidedCode: z.string().optional(),
  quantityReceived: z.number().positive(),
  expiryDate: z.string(),
  coaDocumentUrl: z.string().url().optional(),
});
