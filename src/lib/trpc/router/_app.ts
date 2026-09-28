import { router } from "@/lib/trpc/trpc";

export const appRouter = router({});

export type AppRouter = typeof appRouter;
