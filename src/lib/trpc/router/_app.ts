import { router } from "@/lib/trpc/trpc";
import { materialsRouter } from "@/lib/trpc/router/materials";

export const appRouter = router({ materials: materialsRouter });

export type AppRouter = typeof appRouter;
