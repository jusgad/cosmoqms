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
type NewUser = { id: string; tenantId: string; role: string; active: boolean };
let existingUser: { id: string } | null = null;
let usersInTenant = 0;
const userFindUnique = vi.fn(async () => existingUser);
const userCount = vi.fn(async () => usersInTenant);
const userCreate = vi.fn(async (args: { data: NewUser }) => args.data);
const userUpdate = vi.fn(async (args: { where: unknown; data: Record<string, unknown> }) => args.data);
const userUpdateMany = vi.fn(async (args: { where: unknown; data: unknown }) => {
  void args;
  return { count: 1 };
});

vi.mock("@/lib/db", () => ({
  withTenant: (_tenantId: string, _actorUserId: string, fn: (tx: unknown) => unknown) =>
    fn({
      organization: { upsert: organizationUpsert },
      user: {
        findUnique: userFindUnique,
        count: userCount,
        create: userCreate,
        update: userUpdate,
        updateMany: userUpdateMany,
      },
    }),
}));

const getOrganizationList = vi.fn();
const createOrganization = vi.fn();
const createOrganizationMembership = vi.fn();
const getOrganizationMembershipList = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({
    organizations: {
      getOrganizationList,
      createOrganization,
      createOrganizationMembership,
    },
    users: { getOrganizationMembershipList },
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
  existingUser = null;
  usersInTenant = 0;
  userCreate.mockClear();
  userUpdate.mockClear();
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

  it("acknowledges a signup the full organization cannot take, and logs why", async () => {
    getOrganizationList.mockResolvedValue({ data: [{ id: "org_existing", name: "CosmoQMS" }] });
    createOrganizationMembership.mockRejectedValue({
      errors: [{ code: "organization_membership_quota_exceeded", message: "quota exceeded" }],
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await POST(userCreatedRequest(undefined));

    // Retrying cannot free a seat, so Clerk must not keep redelivering it.
    expect(res.status).toBe(200);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("límite de miembros de Clerk"));
    log.mockRestore();
  });

  it("still fails loudly on any other Clerk error so the event is retried", async () => {
    getOrganizationList.mockResolvedValue({ data: [{ id: "org_existing", name: "CosmoQMS" }] });
    createOrganizationMembership.mockRejectedValue(new Error("network down"));
    await expect(POST(userCreatedRequest(undefined))).rejects.toThrow("network down");
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
          public_metadata: { role: "calidad" },
        },
      ]),
    );

    expect(res.status).toBe(200);
    expect(getOrganizationList).not.toHaveBeenCalled();
    expect(createOrganization).not.toHaveBeenCalled();
    expect(createOrganizationMembership).not.toHaveBeenCalled();
    // A role an admin set in Clerk's metadata is honored, active.
    expect(userCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ id: "user_new", tenantId: "org_invited", role: "calidad", active: true }),
    });
  });

  function membershipEvent(publicMetadata: Record<string, unknown> = {}): Request {
    return new Request("http://localhost/api/webhooks/clerk", {
      method: "POST",
      headers: SVIX_HEADERS,
      body: JSON.stringify({
        type: "organizationMembership.created",
        data: {
          organization: { id: "org_default", name: "CosmoQMS" },
          public_user_data: { user_id: "user_new", identifier: "nueva@example.com", first_name: "Nueva", last_name: "Persona" },
          public_metadata: publicMetadata,
        },
      }),
    });
  }

  it("makes the company's first account its active administrator", async () => {
    usersInTenant = 0;
    expect((await POST(membershipEvent())).status).toBe(200);
    expect(userCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ role: "admin", active: true }) });
  });

  it("creates everyone after the first one inactive, pending a role from the administrator", async () => {
    usersInTenant = 3;
    expect((await POST(membershipEvent())).status).toBe(200);
    expect(userCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ active: false }) });
  });

  it("ignores a role that does not exist (the retired operario)", async () => {
    usersInTenant = 3;
    await POST(membershipEvent({ role: "operario" }));
    expect(userCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ active: false }) });
  });

  it("never overwrites the role of a user that already exists", async () => {
    existingUser = { id: "user_new" };
    await POST(membershipEvent({ role: "admin" }));
    expect(userCreate).not.toHaveBeenCalled();
    expect(userUpdate.mock.calls[0][0].data).not.toHaveProperty("role");
  });
});

describe("POST /api/webhooks/clerk — user.updated", () => {
  it("syncs only the MFA flag, in every tenant the user belongs to", async () => {
    getOrganizationMembershipList.mockResolvedValue({ data: [{ organization: { id: "org_default" } }] });

    const res = await POST(
      new Request("http://localhost/api/webhooks/clerk", {
        method: "POST",
        headers: SVIX_HEADERS,
        body: JSON.stringify({ type: "user.updated", data: { id: "user_1", two_factor_enabled: true } }),
      }),
    );

    expect(res.status).toBe(200);
    expect(getOrganizationMembershipList).toHaveBeenCalledWith({ userId: "user_1" });
    expect(userUpdateMany).toHaveBeenCalledWith({
      where: { id: "user_1", tenantId: "org_default" },
      data: { mfaEnabled: true },
    });
    expect(userCreate).not.toHaveBeenCalled();
  });
});
