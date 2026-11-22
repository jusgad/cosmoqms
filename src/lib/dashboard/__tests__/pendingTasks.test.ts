import { describe, it, expect, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { loadPendingTasks } from "../pendingTasks";

function makeTx(overrides: { orderCount?: number; qualityOrders?: { signatures: unknown[] }[] } = {}) {
  const count = vi.fn(async () => overrides.orderCount ?? 2);
  return {
    tx: {
      productionOrder: { count, findMany: vi.fn(async () => overrides.qualityOrders ?? []) },
      masterFormula: { count: vi.fn(async () => 1) },
      rawMaterialLot: {
        count: vi.fn(async () => 3),
        findMany: vi.fn(async () => [
          { quantityAvailable: 2, quantityReceived: 50, expiryDate: new Date(Date.now() + 5 * 86400000) },
          { quantityAvailable: 40, quantityReceived: 50, expiryDate: new Date(Date.now() + 300 * 86400000) },
        ]),
      },
      deviation: { count: vi.fn(async () => 0) },
      sop: { count: vi.fn(async () => 1) },
      user: { count: vi.fn(async () => 4) },
    } as unknown as Prisma.TransactionClient,
    count,
  };
}

describe("loadPendingTasks", () => {
  it("gives the operator weighing and signing work, scoped to the tenant", async () => {
    const { tx, count } = makeTx();
    const tasks = await loadPendingTasks(tx, "t1", "operario", "u1");
    expect(tasks.map((task) => task.key)).toEqual(["pesar", "firmar", "leer"]);
    expect(count).toHaveBeenCalledWith({ where: { tenantId: "t1", status: { in: ["planificado", "pesado"] } } });
  });

  it("splits orders in quality between the analyst and the director by the quality signature", async () => {
    const qualityOrders = [{ signatures: [] }, { signatures: [{ id: "s1" }] }, { signatures: [{ id: "s2" }] }];
    const calidad = await loadPendingTasks(makeTx({ qualityOrders }).tx, "t1", "calidad", "u1");
    const director = await loadPendingTasks(makeTx({ qualityOrders }).tx, "t1", "director_tecnico", "u1");
    expect(calidad.find((task) => task.key === "qc")?.count).toBe(1);
    expect(director.find((task) => task.key === "liberar")?.count).toBe(2);
  });

  it("drops tasks with nothing pending", async () => {
    const tasks = await loadPendingTasks(makeTx().tx, "t1", "calidad", "u1");
    expect(tasks.some((task) => task.key === "desviaciones")).toBe(false);
  });

  it("shows bodega its low-stock and expiring lots and the admin its accounts without MFA", async () => {
    const bodega = await loadPendingTasks(makeTx().tx, "t1", "bodega", "u1");
    expect(bodega.find((task) => task.key === "stock")?.count).toBe(1);
    expect(bodega.find((task) => task.key === "vencen")?.count).toBe(1);
    const admin = await loadPendingTasks(makeTx().tx, "t1", "admin", "u1");
    expect(admin).toEqual([{ key: "mfa", label: "Cuentas activas sin MFA", count: 4, href: "/usuarios/revision" }]);
  });
});
