import { z } from "zod";

// Schema-only module (bundle-safe): imported by the SOP client components.

// Who does what with controlled documents. Plain strings (not the Prisma
// `Role` enum) keep this module client-safe; the router enforces them.
export const SOP_VIEW_ROLES = ["operario", "jefe_planta", "calidad", "director_tecnico", "bodega"] as const;
export const SOP_EDIT_ROLES = ["calidad", "director_tecnico"] as const;
export const SOP_APPROVE_ROLES = ["director_tecnico"] as const;

export const SOP_STATUS_LABELS = {
  borrador: "Borrador",
  vigente: "Vigente",
  obsoleto: "Obsoleto",
} as const;

export const SOP_APPROVAL_MEANING_STATEMENT =
  "Apruebo este procedimiento como versión vigente y autorizo su uso en planta";

export const SOP_ACK_STATEMENT = "Leí y entendí este procedimiento y lo aplicaré en mi trabajo";

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)");

export const createSopInput = z.object({
  code: z
    .string()
    .trim()
    .min(2, "El código es obligatorio")
    .max(40)
    .regex(/^[A-Za-z0-9._-]+$/, "Use solo letras, números, punto, guion o guion bajo")
    .transform((value) => value.toUpperCase()),
  title: z.string().trim().min(3, "El título es obligatorio").max(200),
  changeSummary: z.string().trim().max(1000).optional(),
});

export const approveSopInput = z.object({
  id: z.string().uuid(),
  effectiveDate: isoDay,
  reviewDue: isoDay,
  meaningStatement: z.literal(SOP_APPROVAL_MEANING_STATEMENT),
  reauthVerified: z.literal(true, { error: "Se requiere reautenticación" }),
});

export const sopIdInput = z.object({ id: z.string().uuid() });

export type CreateSopInput = z.infer<typeof createSopInput>;
export type ApproveSopInput = z.infer<typeof approveSopInput>;
