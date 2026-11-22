import { clerkClient } from "@clerk/nextjs/server";
import { isDemoMode } from "@/lib/demoMode";
import type { SignInInfo } from "@/lib/users/accessReview";

// Last sign-in and MFA status come from Clerk (CosmoQMS never sees the
// credentials). In demo mode, or if Clerk cannot be reached, the review still
// renders from the database alone and says the sign-in data is unavailable.
export async function loadSignIns(userIds: string[]): Promise<{ signIns: Map<string, SignInInfo>; available: boolean }> {
  const signIns = new Map<string, SignInInfo>();
  if (isDemoMode() || userIds.length === 0) return { signIns, available: false };
  try {
    const client = await clerkClient();
    const { data } = await client.users.getUserList({ userId: userIds, limit: 500 });
    for (const user of data) {
      signIns.set(user.id, {
        lastSignInAt: user.lastSignInAt ? new Date(user.lastSignInAt) : null,
        twoFactorEnabled: user.twoFactorEnabled,
      });
    }
    return { signIns, available: true };
  } catch {
    return { signIns, available: false };
  }
}
