import { router } from "@/lib/trpc/trpc";
import { materialsRouter } from "@/lib/trpc/router/materials";
import { formulasRouter } from "@/lib/trpc/router/formulas";
import { productionRouter } from "@/lib/trpc/router/production";

export const appRouter = router({
  materials: materialsRouter,
  formulas: formulasRouter,
  production: productionRouter,
});

export type AppRouter = typeof appRouter;
