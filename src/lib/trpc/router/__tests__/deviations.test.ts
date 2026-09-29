import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma } from "@prisma/client";

// Zero-`any` precedent (Tasks 6-12): mocks are typed against the actual
// Prisma delegate call shapes rather than using `any`.
type DeviationCreateArgs = Prisma.DeviationCreateArgs;
type DeviationUpdateManyArgs = Prisma.DeviationUpdateManyArgs;

const deviationCreate = vi.fn(async (args: DeviationCreateArgs) => ({ id: "dev1", ...args.data }));
let updateManyCount = 1;
const deviationUpdateMany = vi.fn(async (args: DeviationUpdateManyArgs): Promise<{ count: number }> => {
  void args; // typed for the `toHaveBeenCalledWith` assertions below, not read here
  return { count: updateManyCount };
});
const deviationFindUniqueOrThrow = vi.fn(async () => ({
  id: "dev1",
  tenantId: "t1",
  productionOrderId: "po1",
  description: "desc",
  investigation: "inv",
  correctiveAction: "ca",
  status: "cerrada" as const,
  raisedBy: "u1",
  approvedBy: "u2",
  approvedAt: new Date(),
}));
const deviationFindMany = vi.fn(async () => []);

vi.mock("@/lib/db", () => ({
  withTenant: (_tenantId: string, fn: (tx: unknown) => unknown) =>
    fn({
      deviation: {
        create: deviationCreate,
        updateMany: deviationUpdateMany,
        findUniqueOrThrow: deviationFindUniqueOrThrow,
        findMany: deviationFindMany,
      },
    }),
}));

import { deviationsRouter } from "../deviations";

const caller = (role: "calidad" | "jefe_planta" | "operario" | "director_tecnico" | "bodega" | "admin") =>
  deviationsRouter.createCaller({ user: { id: "u1", tenantId: "t1", role }, prisma: {} as never });

describe("deviations.approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateManyCount = 1;
  });

  it("rejects approval from a role other than director_tecnico (brief's literal Step 1 scenario)", async () => {
    await expect(caller("calidad").approve({ id: "550e8400-e29b-41d4-a716-446655440000" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("approves a pendiente_aprobacion deviation as director_tecnico, closing it", async () => {
    const result = await caller("director_tecnico").approve({ id: "550e8400-e29b-41d4-a716-446655440000" });
    expect(result.status).toBe("cerrada");
    expect(deviationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "pendiente_aprobacion" }),
        data: expect.objectContaining({ status: "cerrada", approvedBy: "u1" }),
      }),
    );
  });

  it("throws CONFLICT (TOCTOU guard) when the deviation is no longer pendiente_aprobacion", async () => {
    updateManyCount = 0;
    await expect(caller("director_tecnico").approve({ id: "550e8400-e29b-41d4-a716-446655440000" })).rejects.toMatchObject(
      { code: "CONFLICT" },
    );
  });
});

describe("deviations.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateManyCount = 1;
  });

  it("rejects create from a role not in calidad/jefe_planta/operario", async () => {
    await expect(
      caller("bodega").create({ productionOrderId: "550e8400-e29b-41d4-a716-446655440000", description: "0123456789" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("creates a deviation with status abierta", async () => {
    const result = await caller("operario").create({
      productionOrderId: "550e8400-e29b-41d4-a716-446655440000",
      description: "0123456789",
    });
    expect(result.status).toBe("abierta");
    expect(deviationCreate).toHaveBeenCalled();
  });
});

describe("deviations.investigate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateManyCount = 1;
  });

  it("rejects investigate from a role other than calidad", async () => {
    await expect(
      caller("operario").investigate({
        id: "550e8400-e29b-41d4-a716-446655440000",
        investigation: "0123456789",
        correctiveAction: "0123456789",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("submits investigation + corrective action, moving to pendiente_aprobacion", async () => {
    const result = await caller("calidad").investigate({
      id: "550e8400-e29b-41d4-a716-446655440000",
      investigation: "0123456789",
      correctiveAction: "0123456789",
    });
    expect(deviationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { in: ["abierta", "en_investigacion"] } }),
        data: expect.objectContaining({ status: "pendiente_aprobacion" }),
      }),
    );
    expect(result.id).toBe("dev1");
  });

  it("throws CONFLICT (TOCTOU guard) when the deviation is not abierta/en_investigacion", async () => {
    updateManyCount = 0;
    await expect(
      caller("calidad").investigate({
        id: "550e8400-e29b-41d4-a716-446655440000",
        investigation: "0123456789",
        correctiveAction: "0123456789",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
