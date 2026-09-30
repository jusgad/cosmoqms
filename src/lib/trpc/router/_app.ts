import { router } from "@/lib/trpc/trpc";
import { materialsRouter } from "@/lib/trpc/router/materials";
import { formulasRouter } from "@/lib/trpc/router/formulas";
import { productionRouter } from "@/lib/trpc/router/production";
import { qcRouter } from "@/lib/trpc/router/qc";
import { deviationsRouter } from "@/lib/trpc/router/deviations";
import { traceabilityRouter } from "@/lib/trpc/router/traceability";
import { auditRouter } from "@/lib/trpc/router/audit";

export const appRouter = router({
  materials: materialsRouter,
  formulas: formulasRouter,
  production: productionRouter,
  qc: qcRouter,
  deviations: deviationsRouter,
  traceability: traceabilityRouter,
  audit: auditRouter,
});

export type AppRouter = typeof appRouter;
