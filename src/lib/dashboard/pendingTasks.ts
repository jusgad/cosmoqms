import type { Prisma, Role } from "@prisma/client";
import { isLowStock } from "@/lib/materials/lotAvailability";

// "Mis pendientes": what is waiting for the signed-in person's role, with a
// link to where it is done. Counts only — the lists live in each module.
// Every query filters by `tenantId` explicitly (defense in depth on top of
// RLS). A task with count 0 is dropped by the caller.

export type PendingTask = { key: string; label: string; count: number; href: string };

const FLOOR_ROLES: Role[] = ["jefe_planta", "bodega", "calidad", "director_tecnico"];

async function unreadSops(tx: Prisma.TransactionClient, tenantId: string, userId: string): Promise<number> {
  return tx.sop.count({ where: { tenantId, status: "vigente", acknowledgments: { none: { userId } } } });
}

async function ordersInQuality(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.productionOrder.findMany({
    where: { tenantId, status: "calidad" },
    select: { id: true, signatures: { where: { stage: "calidad" }, select: { id: true } } },
  });
}

export async function loadPendingTasks(
  tx: Prisma.TransactionClient,
  tenantId: string,
  role: Role,
  userId: string,
): Promise<PendingTask[]> {
  const tasks: PendingTask[] = [];
  const add = (key: string, label: string, count: number, href: string) => tasks.push({ key, label, count, href });

  if (role === "jefe_planta") {
    add("pesar", "Órdenes por pesar", await tx.productionOrder.count({ where: { tenantId, status: { in: ["planificado", "pesado"] } } }), "/produccion");
    add("firmar", "Etapas de mezclado o envasado por firmar", await tx.productionOrder.count({ where: { tenantId, status: { in: ["mezclado", "envasado"] } } }), "/produccion");
    add("borradores", "Fórmulas en borrador", await tx.masterFormula.count({ where: { tenantId, status: "draft" } }), "/formulas");
  }
  if (role === "bodega") {
    const lots = await tx.rawMaterialLot.findMany({
      where: { tenantId, status: "liberado" },
      select: { quantityAvailable: true, quantityReceived: true, expiryDate: true },
    });
    const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    add("stock", "Lotes con stock bajo o agotado", lots.filter((lot) => Number(lot.quantityAvailable) <= 0 || isLowStock(Number(lot.quantityAvailable), Number(lot.quantityReceived))).length, "/materias-primas");
    add("vencen", "Lotes liberados que vencen en 30 días", lots.filter((lot) => lot.expiryDate <= soon).length, "/materias-primas");
  }
  if (role === "calidad") {
    const quality = await ordersInQuality(tx, tenantId);
    add("cuarentena", "Lotes de materia prima en cuarentena", await tx.rawMaterialLot.count({ where: { tenantId, status: "cuarentena" } }), "/materias-primas");
    add("qc", "Órdenes esperando control de calidad", quality.filter((order) => order.signatures.length === 0).length, "/calidad");
    add("desviaciones", "Desviaciones por investigar", await tx.deviation.count({ where: { tenantId, status: { in: ["abierta", "en_investigacion"] } } }), "/calidad/desviaciones");
    add("activar", "Fórmulas en borrador por revisar y activar", await tx.masterFormula.count({ where: { tenantId, status: "draft" } }), "/formulas");
  }
  if (role === "director_tecnico") {
    const quality = await ordersInQuality(tx, tenantId);
    add("liberar", "Lotes listos para liberar o rechazar", quality.filter((order) => order.signatures.length > 0).length, "/produccion");
    add("aprobar", "Desviaciones pendientes de aprobación", await tx.deviation.count({ where: { tenantId, status: "pendiente_aprobacion" } }), "/calidad/desviaciones");
    add("sops", "SOPs en borrador por aprobar", await tx.sop.count({ where: { tenantId, status: "borrador" } }), "/sops");
  }
  if (FLOOR_ROLES.includes(role)) {
    add("leer", "SOPs vigentes por leer", await unreadSops(tx, tenantId, userId), "/sops");
  }
  if (role === "admin") {
    add("mfa", "Cuentas activas sin MFA", await tx.user.count({ where: { tenantId, active: true, mfaEnabled: false } }), "/usuarios/revision");
  }

  return tasks.filter((task) => task.count > 0);
}
