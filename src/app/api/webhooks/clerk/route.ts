import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { withTenant } from "@/lib/db";
import type { Role } from "@prisma/client";
import { clerkClient } from "@clerk/nextjs/server";
import type {
  OrganizationJSON,
  OrganizationMembershipJSON,
  UserJSON,
  WebhookEvent,
} from "@clerk/nextjs/server";

// Single-company MVP (2026-10-11 decision, "Simplificar el login"): the app
// no longer asks a new user to create or join an organization. Every signup
// auto-joins the one existing Clerk Organization (creating it on the very
// first signup ever). `tenant_id`/RLS stay exactly as built — there's still
// genuinely one row in `organizations` and every query is still tenant-
// scoped — so re-enabling multi-company later is a UI/webhook change only,
// never a schema or security rewrite.
const DEFAULT_ORGANIZATION_NAME = "CosmoQMS";
// Clerk's own membership role (not our business `Role` enum, which lives in
// `public_metadata.role` and is resolved separately by `resolveRole` below).
const DEFAULT_CLERK_MEMBERSHIP_ROLE = "org:member";

const VALID_ROLES: readonly string[] = [
  "operario",
  "jefe_planta",
  "calidad",
  "director_tecnico",
  "bodega",
  "admin",
];

const DEFAULT_ROLE: Role = "operario";

function resolveRole(publicMetadata: unknown): Role {
  const candidate =
    typeof publicMetadata === "object" && publicMetadata !== null
      ? (publicMetadata as Record<string, unknown>).role
      : undefined;
  return typeof candidate === "string" && VALID_ROLES.includes(candidate)
    ? (candidate as Role)
    : DEFAULT_ROLE;
}

function fullNameFrom(firstName: string | null, lastName: string | null, fallback: string): string {
  const name = [firstName, lastName].filter((part): part is string => Boolean(part)).join(" ").trim();
  return name.length > 0 ? name : fallback;
}

// Final-review fix (Critical 2c, RLS readiness): every write here runs
// inside `withTenant(<the org the event is about>, ...)` rather than on the
// bare top-level `prisma` client, so `app.current_tenant_id` is set and the
// `organizations`/`users` RLS policies in `supabase/rls.sql` (which use
// `current_setting('app.current_tenant_id', true)`) admit exactly the rows
// this event concerns. On a bare client that setting is NULL, and once RLS is
// enforced every upsert here would be refused by the policy's `WITH CHECK`.
// The actor recorded for any (hypothetical) audited write is the webhook
// itself — no regulated table is written here, so nothing reaches audit_log.
const WEBHOOK_ACTOR = "clerk-webhook";

async function upsertOrganization(data: OrganizationJSON): Promise<void> {
  await withTenant(data.id, WEBHOOK_ACTOR, (tx) =>
    tx.organization.upsert({
      where: { id: data.id },
      create: { id: data.id, name: data.name },
      update: { name: data.name },
    }),
  );
}

async function upsertUserFromMembership(membership: OrganizationMembershipJSON): Promise<void> {
  const tenantId = membership.organization.id;
  const userId = membership.public_user_data.user_id;
  const role = resolveRole(membership.public_metadata);
  const email = membership.public_user_data.identifier;
  const fullName = fullNameFrom(
    membership.public_user_data.first_name,
    membership.public_user_data.last_name,
    email,
  );

  // Known limitation once RLS is enforced: if this Clerk user already has a
  // `users` row under a DIFFERENT tenant (moved between organizations), the
  // policy hides that row from this tenant-scoped upsert, which then tries an
  // INSERT and fails on the primary key. Multi-org membership is out of the
  // current single-org MVP scope; see supabase/rls.sql's header.
  await withTenant(tenantId, WEBHOOK_ACTOR, (tx) =>
    tx.user.upsert({
      where: { id: userId },
      create: { id: userId, tenantId, fullName, email, role },
      update: { tenantId, fullName, email, role },
    }),
  );
}

/**
 * Returns the one Clerk Organization every user joins, creating it the very
 * first time any user signs up. Asking Clerk's own org list (not our DB)
 * sidesteps the chicken-and-egg problem of needing a `tenantId` to query a
 * tenant-scoped table before any tenant is known yet.
 *
 * Known race (accepted for this single-tenant MVP, not mitigated): two
 * signups landing before either's `getOrganizationList` call resolves could
 * each see zero organizations and each create one, yielding two orgs
 * instead of one. Harmless for a low-traffic internal tool's first users;
 * revisit with a lock/unique-slug constraint if that ever matters.
 */
async function getOrCreateDefaultOrganization(createdByUserId: string): Promise<{ id: string; name: string }> {
  const client = await clerkClient();
  const existing = await client.organizations.getOrganizationList({ limit: 1 });
  if (existing.data.length > 0) {
    return existing.data[0];
  }
  return client.organizations.createOrganization({
    name: DEFAULT_ORGANIZATION_NAME,
    createdBy: createdByUserId,
  });
}

/**
 * `user.created` fires without organization context unless the user was
 * already invited into an org (Clerk includes `organization_memberships` on
 * the user payload in that case). Previously this app deferred creating the
 * `User` row until the user manually created/joined an organization via
 * Clerk's UI. Single-company MVP: instead, auto-join them to the one
 * default organization right here — no organization UI step is ever shown
 * to the user. The resulting `organizationMembership.created` event (Clerk
 * fires webhooks for Backend-API-triggered changes too) upserts the `User`
 * row via the existing handler below, so this function doesn't duplicate
 * that write.
 */
async function handleUserCreated(data: UserJSON): Promise<void> {
  const membership = data.organization_memberships?.[0];
  if (membership) {
    await upsertUserFromMembership(membership);
    return;
  }

  const client = await clerkClient();
  const organization = await getOrCreateDefaultOrganization(data.id);
  await client.organizations.createOrganizationMembership({
    organizationId: organization.id,
    userId: data.id,
    role: DEFAULT_CLERK_MEMBERSHIP_ROLE,
  });
}

async function handleMembershipUpdated(membership: OrganizationMembershipJSON): Promise<void> {
  // Use the same upsert as `organizationMembership.created` (not `update`):
  // out-of-order/redelivered webhooks, or a `user.created` that never found
  // a membership to resolve its tenant, can mean no `User` row exists yet
  // when `.updated` arrives. `update` would throw Prisma P2025 in that case
  // and 500 the whole request, discarding the role change.
  await upsertUserFromMembership(membership);
}

export async function POST(req: Request): Promise<NextResponse> {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "CLERK_WEBHOOK_SECRET no configurado" }, { status: 500 });
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Encabezados svix faltantes" }, { status: 400 });
  }

  const body = await req.text();
  const webhook = new Webhook(webhookSecret);

  let event: WebhookEvent;
  try {
    webhook.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
    event = JSON.parse(body) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: "Firma invalida" }, { status: 400 });
  }

  switch (event.type) {
    case "organization.created":
      await upsertOrganization(event.data);
      break;
    case "user.created":
      await handleUserCreated(event.data);
      break;
    case "organizationMembership.created":
      await upsertUserFromMembership(event.data);
      break;
    case "organizationMembership.updated":
      await handleMembershipUpdated(event.data);
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
