import { describe, it, expect, vi, beforeEach } from "vitest";

type UserRow = { id: string; tenantId: string; fullName: string; email: string; role: string; active: boolean };

let stored: UserRow | null;
const findMany = vi.fn(async (args: unknown) => {
  void args;
  return [];
});
const findFirst = vi.fn(async (args: unknown) => {
  void args;
  return stored;
});
const updateMany = vi.fn(async (args: unknown) => {
  void args;
  return { count: stored ? 1 : 0 };
});
const auditCreate = vi.fn(async (args: unknown) => args);

vi.mock("@/lib/db", () => ({
  withTenant: (_tenantId: string, _actorUserId: string, fn: (tx: unknown) => unknown) =>
    fn({ user: { findMany, findFirst, updateMany }, auditLog: { create: auditCreate } }),
}));

import { usersRouter } from "../users";

type Role = "operario" | "calidad" | "admin" | "director_tecnico";
const caller = (user: { id: string; tenantId: string; role: Role } | null) =>
  usersRouter.createCaller({ user, prisma: {} as never });

const admin = { id: "admin-1", tenantId: "t1", role: "admin" as const };

describe("users router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stored = { id: "u2", tenantId: "t1", fullName: "Ana Pérez", email: "ana@lab.co", role: "operario", active: true };
  });

  it("requires a session and the admin role", async () => {
    await expect(caller(null).list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller({ ...admin, role: "director_tecnico" }).list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller({ ...admin, role: "calidad" }).update({ id: "u2", role: "admin" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("lists only the admin's own tenant", async () => {
    await caller(admin).list();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: "t1" } }));
  });

  it("changes a role inside the tenant and audits before/after in the same transaction", async () => {
    const result = await caller(admin).update({ id: "u2", role: "calidad" });

    expect(findFirst).toHaveBeenCalledWith({ where: { id: "u2", tenantId: "t1" } });
    expect(updateMany).toHaveBeenCalledWith({ where: { id: "u2", tenantId: "t1" }, data: { role: "calidad", active: true } });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "t1",
        tableName: "User",
        recordId: "u2",
        action: "update",
        beforeData: { role: "operario", active: true },
        afterData: { role: "calidad", active: true },
        actorUserId: "admin-1",
      }),
    });
    expect(result).toMatchObject({ id: "u2", role: "calidad", active: true });
  });

  it("deactivates a user and audits it", async () => {
    await caller(admin).update({ id: "u2", active: false });
    expect(updateMany).toHaveBeenCalledWith({ where: { id: "u2", tenantId: "t1" }, data: { role: "operario", active: false } });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ beforeData: { role: "operario", active: true }, afterData: { role: "operario", active: false } }),
    });
  });

  it("does not write or audit when nothing changes", async () => {
    await caller(admin).update({ id: "u2", role: "operario" });
    expect(updateMany).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("never lets an admin change their own access", async () => {
    stored = { ...stored!, id: "admin-1", role: "admin" };
    await expect(caller(admin).update({ id: "admin-1", active: false })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller(admin).update({ id: "admin-1", role: "operario" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("rejects a user from another tenant as not found", async () => {
    stored = null;
    await expect(caller(admin).update({ id: "otro", role: "calidad" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("rejects an update with nothing to change and an unknown role", async () => {
    await expect(caller(admin).update({ id: "u2" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller(admin).update({ id: "u2", role: "superadmin" as never })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
