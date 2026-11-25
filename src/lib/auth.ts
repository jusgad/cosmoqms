import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { withTenant } from "@/lib/db";
import type { Role } from "@prisma/client";
import { isDemoMode } from "@/lib/demoMode";

export type CurrentUser = { id: string; tenantId: string; role: Role };

// Final-review fix (Critical 2c, RLS readiness): the `User` lookup runs inside
// `withTenant(orgId, ...)` — i.e. with `app.current_tenant_id` set to the
// session's active Clerk Organization — instead of on the bare top-level
// `prisma` client. A user's Clerk id is globally unique, so the lookup itself
// needs no tenant filter; but once `db/rls.sql` is enforced, the
// `users` policy only exposes rows whose `tenant_id` matches
// `app.current_tenant_id`. On a bare client that setting is unset
// (`current_setting(..., true)` is NULL), the policy matches nothing, and
// every login would resolve to "no user". Scoping the read to `orgId` returns
// exactly the row this function would accept anyway (it already rejects any
// user whose `tenantId !== orgId`), so behaviour is unchanged without RLS and
// correct with it.
// Demo mode (src/lib/demoMode.ts): a session without Clerk, only on a local
// app URL and only with docker-compose.demo.yml (DEMO_MODE=true).
// `DEMO_ROLE` picks which role the demo session plays (default
// director_tecnico) — e.g. `admin` to exercise catalog writes from Postman.
// The `cosmoqms-demo-role` cookie overrides it per browser, so one E2E run
// can act as every role; it is only read inside demo mode, which is itself
// limited to localhost. An unknown value falls back instead of inventing a role.
export const DEMO_ROLE_COOKIE = "cosmoqms-demo-role";
const DEMO_ROLES: readonly Role[] = ["jefe_planta", "calidad", "director_tecnico", "bodega", "admin"];
function toDemoRole(value: string | undefined): Role | undefined {
  return DEMO_ROLES.find((role) => role === value);
}
async function demoRole(): Promise<Role> {
  const fromCookie = toDemoRole((await cookies()).get(DEMO_ROLE_COOKIE)?.value);
  return fromCookie ?? toDemoRole(process.env.DEMO_ROLE) ?? "director_tecnico";
}

async function ensureDemoUser(): Promise<CurrentUser> {
  const DEMO_USER: CurrentUser = { id: "demo-user", tenantId: "demo-org", role: await demoRole() };
  await withTenant(DEMO_USER.tenantId, DEMO_USER.id, (tx) =>
    tx.organization.upsert({
      where: { id: DEMO_USER.tenantId },
      create: { id: DEMO_USER.tenantId, name: "CosmoQMS Demo" },
      update: {},
    }),
  );
  await withTenant(DEMO_USER.tenantId, DEMO_USER.id, (tx) =>
    tx.user.upsert({
      where: { id: DEMO_USER.id },
      create: {
        id: DEMO_USER.id,
        tenantId: DEMO_USER.tenantId,
        fullName: "Usuario Demo",
        email: "demo@cosmoqms.local",
        role: DEMO_USER.role,
      },
      update: { role: DEMO_USER.role },
    }),
  );
  return DEMO_USER;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (isDemoMode()) return ensureDemoUser();

  const { userId, orgId } = await auth();
  if (!userId || !orgId) return null;
  const user = await withTenant(orgId, userId, (tx) => tx.user.findUnique({ where: { id: userId } }));
  if (!user || !user.active || user.tenantId !== orgId) return null;
  return { id: user.id, tenantId: user.tenantId, role: user.role };
}

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}

export async function requireRole(allowed: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError("No hay sesion activa");
  if (!allowed.includes(user.role)) throw new ForbiddenError(`Rol ${user.role} no autorizado`);
  return user;
}
