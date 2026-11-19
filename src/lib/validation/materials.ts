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

// Raw-material catalog (the material itself, not a received lot). Shared by
// the tRPC router and the REST API (`/api/v1/materias-primas`).
export const rawMaterialInput = z.object({
  code: z.string().trim().min(1, "El código es obligatorio").max(32),
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  unit: z.string().trim().min(1, "La unidad es obligatoria").max(16),
  category: z.string().trim().max(60).optional(),
});

export const rawMaterialUpdateInput = rawMaterialInput
  .partial()
  .refine((value) => Object.values(value).some((field) => field !== undefined), "Envíe al menos un campo a modificar");

export type RawMaterialInput = z.infer<typeof rawMaterialInput>;
export type RawMaterialUpdateInput = z.infer<typeof rawMaterialUpdateInput>;
