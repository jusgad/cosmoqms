import { auth } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";

// Clerk step-up check for electronic signatures (CLAUDE.md rule 3): the
// client-sent `reauthVerified: true` alone is never trusted. Shared by
// `qc.release`/`qc.reject` and `sops.approve`.
export async function assertReverified(action: string): Promise<void> {
  const { has } = await auth();
  if (!has({ reverification: "strict" })) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: `Se requiere reautenticación (verificación de identidad) para ${action}`,
    });
  }
}
