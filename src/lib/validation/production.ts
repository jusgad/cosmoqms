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
//
// Final-review fix (Important 6): `stage` used to be an unrestricted
// `z.string().min(1)`, so a caller could sign `"planificado"` and advance the
// order to `pesado` with no weighing ever recorded. It is now restricted to
// the non-terminal, post-planning `BatchStatus` values that represent a
// completed production stage awaiting attestation.
export const SIGNABLE_STAGES = ["pesado", "mezclado", "envasado", "calidad"] as const;
export type SignableStage = (typeof SIGNABLE_STAGES)[number];

export function isSignableStage(value: string): value is SignableStage {
  return (SIGNABLE_STAGES as readonly string[]).includes(value);
}

// Who may attest each stage (Blueprint's role table, "Roles y permisos"):
// `operario` "captura pesaje/mezclado/envasado de su etapa, firma su etapa",
// with `jefe_planta` (plant supervisor) also allowed for the production
// floor stages. The `calidad` stage is a quality attestation — Blueprint
// gives `calidad` "registrar resultados QC ... aprobar/rechazar puntos
// críticos" and `director_tecnico` "todo lo de calidad", so those two sign it;
// a production operator must never attest QC. Plain string literals (not the
// Prisma `Role` enum value) keep this module client-bundle safe; the router
// enforces it server-side, `SignaturePad`/the batch page only mirror it.
export const STAGE_SIGNER_ROLES: Record<SignableStage, readonly string[]> = {
  pesado: ["operario", "jefe_planta"],
  mezclado: ["operario", "jefe_planta"],
  envasado: ["operario", "jefe_planta"],
  calidad: ["calidad", "director_tecnico"],
};

export const signInput = z.object({
  productionOrderId: z.string().uuid(),
  stage: z.enum(SIGNABLE_STAGES),
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
