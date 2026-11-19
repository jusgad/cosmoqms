import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import type { Role } from "@prisma/client";

const session = vi.hoisted(() => ({ role: "admin" as Role | null }));

vi.mock("@/lib/auth", async () => {
  class UnauthorizedError extends Error {}
  class ForbiddenError extends Error {}
  return {
    UnauthorizedError,
    ForbiddenError,
    requireRole: async (allowed: Role[]) => {
      if (!session.role) throw new UnauthorizedError("No hay sesion activa");
      if (!allowed.includes(session.role)) throw new ForbiddenError(`Rol ${session.role} no autorizado`);
      return { id: "u1", tenantId: "t1", role: session.role };
    },
  };
});

const catalog = vi.hoisted(() => ({
  createRawMaterial: vi.fn(),
  getRawMaterial: vi.fn(),
  updateRawMaterial: vi.fn(),
  deleteRawMaterial: vi.fn(),
}));
vi.mock("@/lib/materials/catalog", () => catalog);

const findMany = vi.hoisted(() => vi.fn(async () => [{ id: "m1", code: "MP-001" }]));
vi.mock("@/lib/db", () => ({
  withTenant: (_tenantId: string, _actor: string, fn: (tx: unknown) => unknown) => fn({ rawMaterial: { findMany } }),
}));

import { GET as list, POST as create } from "../route";
import { DELETE as remove, GET as getOne, PATCH as update } from "../[id]/route";

const ID = "550e8400-e29b-41d4-a716-446655440000";
const params = (id = ID) => ({ params: Promise.resolve({ id }) });
const json = (method: string, body: unknown) =>
  new Request("http://localhost/api/v1/materias-primas", {
    method,
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("/api/v1/materias-primas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.role = "admin";
  });

  it("GET lists the tenant's catalog", async () => {
    const response = await list();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [{ id: "m1", code: "MP-001" }], total: 1 });
    expect(findMany).toHaveBeenCalledWith({ where: { tenantId: "t1" }, orderBy: { code: "asc" } });
  });

  it("401 without a session, 403 for a role outside the endpoint", async () => {
    session.role = null;
    expect((await list()).status).toBe(401);
    session.role = "operario";
    expect((await list()).status).toBe(403);
    session.role = "calidad";
    expect((await create(json("POST", { code: "A", name: "B", unit: "kg" }))).status).toBe(403);
  });

  it("POST creates with 201 and a Location header", async () => {
    catalog.createRawMaterial.mockResolvedValueOnce({ id: ID, code: "MP-010" });
    const response = await create(json("POST", { code: " MP-010 ", name: "Pantenol", unit: "kg" }));
    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/v1/materias-primas/${ID}`);
    expect(catalog.createRawMaterial).toHaveBeenCalledWith(expect.anything(), "t1", { code: "MP-010", name: "Pantenol", unit: "kg" });
  });

  it("POST answers 400 with the failing field for invalid input or broken JSON", async () => {
    const invalid = await create(json("POST", { code: "", name: "Pantenol", unit: "kg" }));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ issues: [{ path: "code" }] });
    expect((await create(json("POST", "{no es json"))).status).toBe(400);
    expect(catalog.createRawMaterial).not.toHaveBeenCalled();
  });

  it("POST maps a duplicate code to 409", async () => {
    catalog.createRawMaterial.mockRejectedValueOnce(new TRPCError({ code: "CONFLICT", message: "Ya existe" }));
    expect((await create(json("POST", { code: "MP-001", name: "Agua", unit: "kg" }))).status).toBe(409);
  });
});

describe("/api/v1/materias-primas/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.role = "admin";
  });

  it("GET returns one material, 404 for a malformed or unknown id", async () => {
    catalog.getRawMaterial.mockResolvedValueOnce({ id: ID });
    expect((await getOne(new Request("http://x"), params())).status).toBe(200);
    expect((await getOne(new Request("http://x"), params("not-a-uuid"))).status).toBe(404);
    catalog.getRawMaterial.mockRejectedValueOnce(new TRPCError({ code: "NOT_FOUND", message: "no" }));
    expect((await getOne(new Request("http://x"), params())).status).toBe(404);
  });

  it("PATCH applies a partial change and rejects an empty body", async () => {
    catalog.updateRawMaterial.mockResolvedValueOnce({ id: ID, name: "D-Pantenol" });
    const ok = await update(json("PATCH", { name: "D-Pantenol" }), params());
    expect(ok.status).toBe(200);
    expect(catalog.updateRawMaterial).toHaveBeenCalledWith(expect.anything(), "t1", ID, { name: "D-Pantenol" });
    expect((await update(json("PATCH", {}), params())).status).toBe(400);
  });

  it("DELETE removes an unused material and answers 409 when it has history", async () => {
    catalog.deleteRawMaterial.mockResolvedValueOnce({ id: ID });
    const ok = await remove(new Request("http://x", { method: "DELETE" }), params());
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ deleted: true });

    catalog.deleteRawMaterial.mockRejectedValueOnce(new TRPCError({ code: "CONFLICT", message: "tiene lotes" }));
    expect((await remove(new Request("http://x", { method: "DELETE" }), params())).status).toBe(409);
  });
});
