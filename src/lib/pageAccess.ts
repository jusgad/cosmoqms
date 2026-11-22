import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";

// Which roles may open each module's pages lives in src/lib/roles/modules.ts
// (shared with the menu). The tRPC/REST procedures keep their own role
// checks; this is the page gate.
export { MODULE_ROLES } from "@/lib/roles/modules";

export async function requirePageRole(allowed: readonly Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (!allowed.includes(user.role)) {
    redirect("/dashboard");
  }
  return user;
}
