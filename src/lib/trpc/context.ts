import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function createTRPCContext() {
  const user = await getCurrentUser();
  return { prisma, user };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
