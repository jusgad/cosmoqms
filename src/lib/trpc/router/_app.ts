import { router } from "@/lib/trpc/trpc";
import { materialsRouter } from "@/lib/trpc/router/materials";
import { formulasRouter } from "@/lib/trpc/router/formulas";

export const appRouter = router({ materials: materialsRouter, formulas: formulasRouter });

export type AppRouter = typeof appRouter;
