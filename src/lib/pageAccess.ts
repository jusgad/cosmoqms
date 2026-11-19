import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";

// Which roles may open each module's pages. Mirrors the menu (Sidebar.tsx
// NAV_ITEMS), so typing a URL by hand never shows a module the menu hides.
// Found by the E2E suite: several list/detail pages rendered for any role.
// The tRPC/REST procedures keep their own role checks; this is the page gate.
export const MODULE_ROLES = {
  materiasPrimas: ["bodega", "jefe_planta", "calidad", "director_tecnico"],
  formulas: ["jefe_planta", "calidad", "director_tecnico"],
  produccion: ["jefe_planta", "operario", "calidad", "director_tecnico"],
  // Deviations are reported from the floor (operario, jefe_planta) and the
  // reporter lands on the detail page — same roles as deviationsRouter.list.
  desviaciones: ["calidad", "director_tecnico", "jefe_planta", "operario"],
} as const satisfies Record<string, readonly Role[]>;

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
