import { auth } from "@clerk/nextjs/server";
import { withTenant } from "@/lib/db";
import type { Role } from "@prisma/client";

export type CurrentUser = { id: string; tenantId: string; role: Role };

// Final-review fix (Critical 2c, RLS readiness): the `User` lookup runs inside
// `withTenant(orgId, ...)` — i.e. with `app.current_tenant_id` set to the
// session's active Clerk Organization — instead of on the bare top-level
// `prisma` client. A user's Clerk id is globally unique, so the lookup itself
// needs no tenant filter; but once `supabase/rls.sql` is enforced, the
// `users` policy only exposes rows whose `tenant_id` matches
// `app.current_tenant_id`. On a bare client that setting is unset
// (`current_setting(..., true)` is NULL), the policy matches nothing, and
// every login would resolve to "no user". Scoping the read to `orgId` returns
// exactly the row this function would accept anyway (it already rejects any
// user whose `tenantId !== orgId`), so behaviour is unchanged without RLS and
// correct with it.
// TEMPORARY (2026-10-11, requested + approved by Sebas): lets a reviewer
// browse every screen without a Clerk session, to capture real screenshots
// for the user manual. Gated behind `DEMO_MODE` so it is inert unless that
// env var is explicitly set to "true" in Vercel, and reverted (this whole
// block removed) once the manual's screenshots are done — see commit
// message for the removal commit.
const DEMO_USER: CurrentUser = { id: "demo-user", tenantId: "demo-org", role: "director_tecnico" };

async function ensureDemoUser(): Promise<CurrentUser> {
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
      update: {},
    }),
  );
  return DEMO_USER;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (process.env.DEMO_MODE === "true") return ensureDemoUser();

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
