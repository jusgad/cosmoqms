import { describe, it, expect, vi, beforeEach } from "vitest";

const current = { name: "CosmoLab", nit: null as string | null, invimaRegistration: null as string | null };
const findFirst = vi.fn(async (args: unknown) => {
  void args;
  return { ...current };
});
const update = vi.fn(async ({ data }: { data: typeof current }) => ({ ...data }));
const auditCreate = vi.fn(async (args: unknown) => args);

vi.mock("@/lib/db", () => ({
  withTenant: (_tenantId: string, _actorUserId: string, fn: (tx: unknown) => unknown) =>
    fn({ organization: { findFirst, update, findFirstOrThrow: findFirst }, auditLog: { create: auditCreate } }),
}));

import { organizationRouter } from "../organization";

type Role = "admin" | "director_tecnico";
const caller = (role: Role) =>
  organizationRouter.createCaller({ user: { id: "u1", tenantId: "t1", role }, prisma: {} as never });

describe("organization router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("only admin reads or changes the company data", async () => {
    await expect(caller("director_tecnico").get()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller("director_tecnico").update({ name: "X S.A.S.", nit: "", invimaRegistration: "" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("updates its own tenant and audits before/after; empty fields become null", async () => {
    await caller("admin").update({ name: "CosmoLab S.A.S.", nit: "900.123.456-7", invimaRegistration: "" });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t1" },
        data: { name: "CosmoLab S.A.S.", nit: "900.123.456-7", invimaRegistration: null },
      }),
    );
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tableName: "Organization",
        recordId: "t1",
        beforeData: { name: "CosmoLab", nit: null, invimaRegistration: null },
        afterData: { name: "CosmoLab S.A.S.", nit: "900.123.456-7", invimaRegistration: null },
      }),
    });
  });

  it("rejects an invalid NIT or empty name", async () => {
    await expect(caller("admin").update({ name: "CosmoLab", nit: "abc", invimaRegistration: "" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(caller("admin").update({ name: " ", nit: "", invimaRegistration: "" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(update).not.toHaveBeenCalled();
  });
});
