import { clerkClient } from "@clerk/nextjs/server";
import { isDemoMode } from "@/lib/demoMode";

// Clerk limits how many people one organization can hold (5 on the free
// plan). When the organization is full, a new signup cannot be added to it:
// Clerk then shows its own "Set up your organization" screen and the person
// never reaches CosmoQMS. These helpers let the webhook say so clearly and
// let /usuarios show the administrator how many seats are left.

export const MEMBERSHIP_QUOTA_CODE = "organization_membership_quota_exceeded";

// Clerk's API errors carry `errors: [{ code, message, ... }]`.
export function isMembershipQuotaError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("errors" in error)) return false;
  const errors = (error as { errors: unknown }).errors;
  return (
    Array.isArray(errors) &&
    errors.some((item) => typeof item === "object" && item !== null && (item as { code?: unknown }).code === MEMBERSHIP_QUOTA_CODE)
  );
}

export type Seats = { used: number; max: number };

// `max` 0 means "no limit set" in Clerk.
export function seatsLeft(seats: Seats): number | null {
  return seats.max > 0 ? Math.max(seats.max - seats.used, 0) : null;
}

// Members plus pending invitations count against the limit. Null in demo
// mode or when Clerk cannot be reached: the page then simply omits the notice.
export async function loadSeats(organizationId: string): Promise<Seats | null> {
  if (isDemoMode()) return null;
  try {
    const client = await clerkClient();
    const [organization, members, invitations] = await Promise.all([
      client.organizations.getOrganization({ organizationId }),
      client.organizations.getOrganizationMembershipList({ organizationId, limit: 1 }),
      client.organizations.getOrganizationInvitationList({ organizationId, status: ["pending"], limit: 1 }),
    ]);
    return { used: members.totalCount + invitations.totalCount, max: organization.maxAllowedMemberships };
  } catch {
    return null;
  }
}
