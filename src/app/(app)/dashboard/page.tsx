import { redirect } from "next/navigation";
import type { DeviationStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { KPICard } from "@/components/dashboard/KPICard";
import { BatchStatusChart } from "@/components/dashboard/BatchStatusChart";
import { MonthlyOutcomeChart } from "@/components/dashboard/MonthlyOutcomeChart";
import { StageDurationChart } from "@/components/dashboard/StageDurationChart";
import { DeviationStatusBreakdown } from "@/components/dashboard/DeviationStatusBreakdown";
import { averageStageDurations, monthlyOutcomes, qcPassRate, windowStart } from "@/lib/dashboard/kpis";
import { loadPendingTasks } from "@/lib/dashboard/pendingTasks";
import { PendingTasks } from "@/components/dashboard/PendingTasks";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { canOpen } from "@/lib/roles/modules";
import { ROLE_LABELS } from "@/lib/validation/users";

const DAYS_UNTIL_EXPIRY_WARNING = 30;
const QC_WINDOW_DAYS = 30;
const TREND_MONTHS = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const tenantId = user.tenantId;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const expiryWindowEnd = new Date(now.getTime() + DAYS_UNTIL_EXPIRY_WARNING * DAY_MS);
  const trendStart = windowStart(now, TREND_MONTHS);
  const qcWindowStart = new Date(now.getTime() - QC_WINDOW_DAYS * DAY_MS);

  const [
    lotesEnCurso,
    vencimientosProximos,
    lotesLiberadosEsteMes,
    statusGroups,
    releasedLots,
    rejectedSignatures,
    timelines,
    deviationGroups,
    recentQc,
  ] = await withTenant(tenantId, user.id, (tx) =>
    Promise.all([
      // Ordenes de produccion que no han llegado a un estado terminal
      // (liberado/rechazado) cuentan como "en curso".
      tx.productionOrder.count({ where: { tenantId, status: { notIn: ["liberado", "rechazado"] } } }),
      // Lotes de materia prima no rechazados que vencen dentro de la ventana
      // de aviso (30 dias), incluidos los ya vencidos que aun no se marcaron
      // como rechazados (requieren atencion inmediata).
      tx.rawMaterialLot.count({
        where: { tenantId, status: { not: "rechazado" }, expiryDate: { lte: expiryWindowEnd } },
      }),
      // Firma final de liberacion (FinishedProductLot.releasedAt) dentro del
      // mes actual: es el momento legal de la liberacion, distinto del fin de
      // actividad en planta.
      tx.finishedProductLot.count({ where: { tenantId, releasedAt: { gte: monthStart, lt: nextMonthStart } } }),
      tx.productionOrder.groupBy({ by: ["status"], where: { tenantId }, _count: { _all: true } }),
      tx.finishedProductLot.findMany({
        where: { tenantId, releasedAt: { gte: trendStart } },
        select: { releasedAt: true },
      }),
      // A rejection leaves no FinishedProductLot; its final signature is the
      // only dated record of it. `BatchSignature` has no tenant column, so
      // it is scoped through its order.
      tx.batchSignature.findMany({
        where: { stage: "rechazado", signedAt: { gte: trendStart }, order: { tenantId } },
        select: { signedAt: true },
      }),
      tx.productionOrder.findMany({
        where: { tenantId, signatures: { some: { signedAt: { gte: trendStart } } } },
        select: {
          signatures: { select: { stage: true, signedAt: true } },
          events: {
            where: { eventType: "weighing" },
            orderBy: { occurredAt: "asc" },
            take: 1,
            select: { occurredAt: true },
          },
        },
      }),
      tx.deviation.groupBy({ by: ["status"], where: { tenantId }, _count: { _all: true } }),
      tx.qcResult.findMany({ where: { tenantId, recordedAt: { gte: qcWindowStart } }, select: { result: true } }),
    ]),
  );

  const statusCounts = statusGroups.map((g) => ({ status: g.status, count: g._count._all }));
  const months = monthlyOutcomes(
    now,
    releasedLots.flatMap((lot) => (lot.releasedAt ? [lot.releasedAt] : [])),
    rejectedSignatures.map((signature) => signature.signedAt),
    TREND_MONTHS,
  );
  const stageDurations = averageStageDurations(
    timelines.map((order) => ({ firstWeighingAt: order.events[0]?.occurredAt ?? null, signatures: order.signatures })),
  );
  const deviationCounts: Partial<Record<DeviationStatus, number>> = Object.fromEntries(
    deviationGroups.map((group) => [group.status, group._count._all]),
  );
  const desviacionesAbiertas = deviationGroups
    .filter((group) => group.status !== "cerrada")
    .reduce((sum, group) => sum + group._count._all, 0);
  const passRate = qcPassRate(recentQc);
  // A KPI tile links to its list only when this role can open that module.
  const link = (module: Parameters<typeof canOpen>[0], href: string) => (canOpen(module, user.role) ? href : undefined);
  const pendingTasks = await withTenant(tenantId, user.id, (tx) => loadPendingTasks(tx, tenantId, user.role, user.id));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-sans text-2xl font-semibold text-foreground">Dashboard</h1>

      <QuickActions role={user.role} />

      <PendingTasks tasks={pendingTasks} roleLabel={ROLE_LABELS[user.role]} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KPICard label="Lotes en curso" value={lotesEnCurso} href={link("produccion", "/produccion")} />
        <KPICard label="Desviaciones abiertas" value={desviacionesAbiertas} href={link("desviaciones", "/calidad/desviaciones")} />
        <KPICard
          label="Vencimientos próximos"
          value={vencimientosProximos}
          hint={`MP en los próximos ${DAYS_UNTIL_EXPIRY_WARNING} días`}
          href={link("materiasPrimas", "/materias-primas")}
        />
        <KPICard label="Lotes liberados este mes" value={lotesLiberadosEsteMes} href={link("trazabilidad", "/trazabilidad")} />
        <KPICard
          href={link("calidad", "/calidad")}
          label={`Conformidad QC (${QC_WINDOW_DAYS} días)`}
          value={passRate.rate === null ? "—" : `${Math.round(passRate.rate * 100)}%`}
          hint={passRate.total === 0 ? "Sin resultados en el período" : `${passRate.passed} de ${passRate.total} resultados`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MonthlyOutcomeChart months={months} />
        <StageDurationChart durations={stageDurations} />
        <BatchStatusChart counts={statusCounts} />
        <DeviationStatusBreakdown counts={deviationCounts} />
      </div>
    </div>
  );
}
