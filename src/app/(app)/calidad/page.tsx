import { MODULE_ROLES, requirePageRole } from "@/lib/pageAccess";
import { withTenant } from "@/lib/db";
import { QCPendingTable, type PendingOrderRow } from "@/app/(app)/calidad/QCPendingTable";

// Server Component reading direct from Prisma (the project's data-flow convention:
// "Server Components leen directo de Prisma para listados/reportes"), same
// query shape as `qc.listPending` (src/lib/trpc/router/qc.ts) — mirrors how
// materias-primas/page.tsx and produccion/page.tsx read their own listings.
export default async function CalidadPage() {
  const user = await requirePageRole(MODULE_ROLES.calidad);

  const orders = await withTenant(user.tenantId, user.id, (tx) =>
    tx.productionOrder.findMany({
      where: { tenantId: user.tenantId, status: "calidad" },
      orderBy: { orderNumber: "asc" },
      include: { formula: true },
    }),
  );

  // Prisma `Decimal` can't cross the Server->Client Component boundary as-is
  // (same reasoning as pesaje/page.tsx) — converted to a plain number here.
  const rows: PendingOrderRow[] = orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    formulaId: order.formulaId,
    formulaName: order.formula.name,
    plannedQuantity: Number(order.plannedQuantity),
  }));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-sans text-2xl font-semibold text-foreground">Control de Calidad</h1>
      <QCPendingTable data={rows} canRecord={user.role === "calidad"} />
    </div>
  );
}
