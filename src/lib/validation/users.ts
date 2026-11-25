import { z } from "zod";

// Schema-only module: safe to import from client components.

export const ROLE_VALUES = ["jefe_planta", "calidad", "director_tecnico", "bodega", "admin"] as const;

export const ROLE_LABELS: Record<(typeof ROLE_VALUES)[number], string> = {
  jefe_planta: "Jefe de planta",
  calidad: "Calidad",
  director_tecnico: "Director técnico",
  bodega: "Bodega",
  admin: "Administrador",
};

export const updateUserInput = z
  .object({
    id: z.string().min(1),
    role: z.enum(ROLE_VALUES).optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => value.role !== undefined || value.active !== undefined, {
    message: "Indique el rol o el estado a cambiar",
  });

export type UpdateUserInput = z.infer<typeof updateUserInput>;
