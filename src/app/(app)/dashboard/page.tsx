import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { KPICard } from "@/app/(app)/dashboard/KPICard";

const DAYS_UNTIL_EXPIRY_WARNING = 30;

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const expiryWindowEnd = new Date(now.getTime() + DAYS_UNTIL_EXPIRY_WARNING * 24 * 60 * 60 * 1000);

  const [lotesEnCurso, desviacionesAbiertas, vencimientosProximos, lotesLiberadosEsteMes] =
    await withTenant(user.tenantId, (tx) =>
      Promise.all([
        // Ordenes de produccion que no han llegado a un estado terminal
        // (liberado/rechazado) cuentan como "en curso".
        tx.productionOrder.count({
          where: { tenantId: user.tenantId, status: { notIn: ["liberado", "rechazado"] } },
        }),
        // Cualquier desviacion que no este formalmente cerrada.
        tx.deviation.count({
          where: { tenantId: user.tenantId, status: { not: "cerrada" } },
        }),
        // Lotes de materia prima no rechazados que vencen dentro de la
        // ventana de aviso (30 dias), incluyendo los ya vencidos que aun
        // no se han marcado como rechazados (requieren atencion inmediata).
        tx.rawMaterialLot.count({
          where: {
            tenantId: user.tenantId,
            status: { not: "rechazado" },
            expiryDate: { lte: expiryWindowEnd },
          },
        }),
        // Lotes con firma final de liberacion (FinishedProductLot.releasedAt)
        // dentro del mes calendario actual. Se usa releasedAt (el momento de
        // la firma legal de director_tecnico) y no ProductionOrder.actualEnd
        // (fin de actividad de planta) porque son eventos distintos: un lote
        // puede terminar produccion en un mes y liberarse legalmente semanas
        // despues, tras cerrar desviaciones.
        tx.finishedProductLot.count({
          where: {
            tenantId: user.tenantId,
            releasedAt: { gte: monthStart, lt: nextMonthStart },
          },
        }),
      ]),
    );

  return (
    <div>
      <h1 className="font-sans text-2xl font-semibold text-foreground">Dashboard</h1>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Lotes en curso" value={lotesEnCurso} />
        <KPICard label="Desviaciones abiertas" value={desviacionesAbiertas} />
        <KPICard label="Vencimientos próximos" value={vencimientosProximos} />
        <KPICard label="Lotes liberados este mes" value={lotesLiberadosEsteMes} />
      </div>
    </div>
  );
}
