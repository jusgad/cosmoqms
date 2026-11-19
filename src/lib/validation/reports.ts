import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use el formato AAAA-MM-DD");
const MAX_RANGE_DAYS = 366;

// Dates are local calendar days (America/Bogota in docker-compose): `from`
// starts at 00:00 and `to` includes the whole day.
export const productionReportQuery = z
  .object({
    from: isoDate,
    to: isoDate,
    format: z.enum(["csv", "pdf"]).default("csv"),
  })
  .transform((value) => {
    const [fy, fm, fd] = value.from.split("-").map(Number);
    const [ty, tm, td] = value.to.split("-").map(Number);
    return {
      format: value.format,
      from: new Date(fy, fm - 1, fd, 0, 0, 0, 0),
      to: new Date(ty, tm - 1, td, 23, 59, 59, 999),
      fromLabel: value.from,
      toLabel: value.to,
    };
  })
  .refine((value) => !Number.isNaN(value.from.getTime()) && !Number.isNaN(value.to.getTime()), "Fecha inválida")
  .refine((value) => value.from <= value.to, "La fecha inicial debe ser anterior a la final")
  .refine(
    (value) => (value.to.getTime() - value.from.getTime()) / 86_400_000 <= MAX_RANGE_DAYS,
    `El período no puede superar ${MAX_RANGE_DAYS} días`,
  );

export type ProductionReportQuery = z.infer<typeof productionReportQuery>;
