import { z } from "zod";

// Schema-only module (same rationale as validation/qc.ts, validation/production.ts,
// etc.): zero dependency on `@/lib/trpc/trpc` or `@/lib/db`, so the client
// component importing it for its filter form's input shape never drags
// `PrismaClient` into the browser bundle.
export const auditSearchInput = z.object({
  tableName: z.string().min(1).optional(),
  actorUserId: z.string().min(1).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export type AuditSearchValues = z.infer<typeof auditSearchInput>;
