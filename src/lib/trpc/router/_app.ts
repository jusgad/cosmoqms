import { router } from "@/lib/trpc/trpc";
import { materialsRouter } from "@/lib/trpc/router/materials";
import { formulasRouter } from "@/lib/trpc/router/formulas";
import { productionRouter } from "@/lib/trpc/router/production";
import { qcRouter } from "@/lib/trpc/router/qc";
import { deviationsRouter } from "@/lib/trpc/router/deviations";

export const appRouter = router({
  materials: materialsRouter,
  formulas: formulasRouter,
  production: productionRouter,
  qc: qcRouter,
  deviations: deviationsRouter,
});

export type AppRouter = typeof appRouter;
