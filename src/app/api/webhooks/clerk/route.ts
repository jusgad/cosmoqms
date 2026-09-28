import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { prisma } from "@/lib/db";
import type { Role } from "@prisma/client";
import type {
  OrganizationJSON,
  OrganizationMembershipJSON,
  UserJSON,
  WebhookEvent,
} from "@clerk/nextjs/server";

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

async function upsertOrganization(data: OrganizationJSON): Promise<void> {
  await prisma.organization.upsert({
    where: { id: data.id },
    create: { id: data.id, name: data.name },
    update: { name: data.name },
  });
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

  await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, tenantId, fullName, email, role },
    update: { tenantId, fullName, email, role },
  });
}

/**
 * `user.created` fires without organization context unless the user was
 * already invited into an org (Clerk includes `organization_memberships` on
 * the user payload in that case). Users created outside any organization
 * have no `tenantId` yet — our schema requires one, so we defer creating
 * the `User` row until `organizationMembership.created` arrives for them.
 */
async function handleUserCreated(data: UserJSON): Promise<void> {
  const membership = data.organization_memberships?.[0];
  if (!membership) return;
  await upsertUserFromMembership(membership);
}

async function handleMembershipUpdated(membership: OrganizationMembershipJSON): Promise<void> {
  await prisma.user.update({
    where: { id: membership.public_user_data.user_id },
    data: { role: resolveRole(membership.public_metadata) },
  });
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
