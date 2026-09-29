import { z } from "zod";

// Schema-only module: intentionally has zero dependency on `@/lib/trpc/trpc`
// or `@/lib/db` (which instantiates `PrismaClient` at module top level).
// QCResultForm.tsx (a Client Component) imports this directly so that its
// bundle never pulls Prisma into the browser — the Task 7 incident this
// guards against, and src/lib/validation/production.ts for the established
// precedent (recordWeighingInput/signInput).
export const recordResultInput = z.object({
  productionOrderId: z.string().uuid(),
  parameter: z.string().min(1),
  measuredValue: z.number(),
  result: z.enum(["pass", "fail"]),
});

export type RecordResultValues = z.infer<typeof recordResultInput>;

// Gap 2 resolution (task-12-brief.md investigation): `release` is the
// blueprint's "firma final" (Section 8) — director_tecnico's legal release
// of a batch to market — so it follows `signInput`'s exact pattern
// (production.ts/task 11): `reauthVerified: z.literal(true)` makes the
// Zod-level guarantee required by Global Constraint 3 ("Ninguna firma
// electrónica se persiste sin reauth_verified = true y meaning_statement
// explícito"), and the router independently re-verifies via Clerk's
// server-side `auth().has({ reverification: "strict" })` — the client-sent
// boolean alone is never trusted, same as `production.sign`.
export const releaseInput = z.object({
  productionOrderId: z.string().uuid(),
  meaningStatement: z.string().min(10, "La declaración de significado es obligatoria"),
  reauthVerified: z.literal(true, { error: "Se requiere reautenticación" }),
});

export type ReleaseValues = z.infer<typeof releaseInput>;

export const RELEASE_MEANING_STATEMENT =
  "Confirmo que reviso los resultados de calidad y libero este lote para su comercialización";
