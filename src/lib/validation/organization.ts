import { z } from "zod";

// Schema-only module (bundle-safe). The company data printed on the BPM
// report header and the batch-record PDF.

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value));

export const updateOrganizationInput = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio").max(120),
  // Colombian NIT: digits, optional dots, and the check digit after a dash.
  nit: optionalText(20).refine((value) => value === null || /^[0-9.]{5,15}-?[0-9]?$/.test(value), {
    message: "NIT inválido (ejemplo: 900.123.456-7)",
  }),
  invimaRegistration: optionalText(40),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationInput>;
