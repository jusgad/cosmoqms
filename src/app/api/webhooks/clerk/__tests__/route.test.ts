import { describe, it, expect, vi, beforeEach } from "vitest";

// `Webhook.verify` is mocked to a no-op: this test exercises the single-
// company auto-provisioning logic, not svix's signature verification
// (which has no business-logic branches to cover here).
vi.mock("svix", () => ({
  Webhook: class {
    verify(): void {
      // no-op: accept every payload as validly signed
    }
  },
}));

const organizationUpsert = vi.fn(async (args: { create: { id: string; name: string } }) => args.create);
const userUpsert = vi.fn(async (args: { create: unknown }) => args.create);

vi.mock("@/lib/db", () => ({
  withTenant: (_tenantId: string, _actorUserId: string, fn: (tx: unknown) => unknown) =>
    fn({
      organization: { upsert: organizationUpsert },
      user: { upsert: userUpsert },
    }),
}));

const getOrganizationList = vi.fn();
const createOrganization = vi.fn();
const createOrganizationMembership = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({
    organizations: {
      getOrganizationList,
      createOrganization,
      createOrganizationMembership,
    },
  }),
}));

import { POST } from "../route";

const SVIX_HEADERS = {
  "svix-id": "msg_test",
  "svix-timestamp": "1700000000",
  "svix-signature": "v1,test",
};

function userCreatedRequest(organizationMemberships: unknown[] | undefined): Request {
  return new Request("http://localhost/api/webhooks/clerk", {
    method: "POST",
    headers: SVIX_HEADERS,
    body: JSON.stringify({
      type: "user.created",
      data: {
        id: "user_new",
        first_name: "Nueva",
        last_name: "Persona",
        email_addresses: [{ id: "idn_1", email_address: "nueva@example.com" }],
        primary_email_address_id: "idn_1",
        organization_memberships: organizationMemberships,
      },
    }),
  });
}

beforeEach(() => {
  process.env.CLERK_WEBHOOK_SECRET = "whsec_test";
  organizationUpsert.mockClear();
  userUpsert.mockClear();
  getOrganizationList.mockReset();
  createOrganization.mockReset();
  createOrganizationMembership.mockReset();
});

describe("POST /api/webhooks/clerk — single-company auto-provisioning", () => {
  it("creates the one default organization on the very first signup and joins the user to it", async () => {
    getOrganizationList.mockResolvedValue({ data: [] });
    createOrganization.mockResolvedValue({ id: "org_default", name: "CosmoQMS" });
    createOrganizationMembership.mockResolvedValue({});

    const res = await POST(userCreatedRequest(undefined));

    expect(res.status).toBe(200);
    expect(getOrganizationList).toHaveBeenCalledWith(expect.objectContaining({ limit: 1 }));
    expect(createOrganization).toHaveBeenCalledWith(
      expect.objectContaining({ name: "CosmoQMS", createdBy: "user_new" }),
    );
    expect(createOrganizationMembership).toHaveBeenCalledWith({
      organizationId: "org_default",
      userId: "user_new",
      role: "org:member",
    });
  });

  it("reuses the existing organization for every subsequent signup instead of creating a second one", async () => {
    getOrganizationList.mockResolvedValue({ data: [{ id: "org_existing", name: "CosmoQMS" }] });
    createOrganizationMembership.mockResolvedValue({});

    const res = await POST(userCreatedRequest(undefined));

    expect(res.status).toBe(200);
    expect(createOrganization).not.toHaveBeenCalled();
    expect(createOrganizationMembership).toHaveBeenCalledWith({
      organizationId: "org_existing",
      userId: "user_new",
      role: "org:member",
    });
  });

  it("does not auto-provision when the user already arrives with an organization membership", async () => {
    const res = await POST(
      userCreatedRequest([
        {
          organization: { id: "org_invited", name: "Ya existe" },
          public_user_data: {
            user_id: "user_new",
            identifier: "nueva@example.com",
            first_name: "Nueva",
            last_name: "Persona",
          },
          public_metadata: {},
        },
      ]),
    );

    expect(res.status).toBe(200);
    expect(getOrganizationList).not.toHaveBeenCalled();
    expect(createOrganization).not.toHaveBeenCalled();
    expect(createOrganizationMembership).not.toHaveBeenCalled();
    expect(userUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ id: "user_new", tenantId: "org_invited" }) }),
    );
  });
});
