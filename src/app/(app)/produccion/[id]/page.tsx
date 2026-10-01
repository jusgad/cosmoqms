import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { StageTracker } from "@/components/batch/StageTracker";
import { EventTimeline } from "@/components/batch/EventTimeline";
import { OfflineIndicator } from "@/components/layout/OfflineIndicator";
import { isSignableStage, STAGE_SIGNER_ROLES } from "@/lib/validation/production";

export default async function BatchRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const order = await withTenant(user.tenantId, user.id, (tx) =>
    tx.productionOrder.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        formula: true,
        events: true,
        signatures: true,
        deviations: true,
      },
    }),
  );
  if (!order) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-mono text-2xl font-semibold text-foreground">{order.orderNumber}</h1>
          <span className="text-sm text-muted-foreground">
            {order.formula.name} (v{order.formulaVersion})
          </span>
        </div>
        <OfflineIndicator />
      </div>

      <StageTracker status={order.status} />

      {order.status === "planificado" && (
        <Button render={<Link href={`/produccion/${order.id}/pesaje`}>Registrar pesaje</Link>} />
      )}
      {/* Final review (Important 6): only shown to a role allowed to sign the
          CURRENT stage — `production.sign` enforces the same rule server-side. */}
      {isSignableStage(order.status) && STAGE_SIGNER_ROLES[order.status].includes(user.role) && (
        <Button render={<Link href={`/produccion/${order.id}/firma`}>Firmar</Link>} />
      )}
      {/* Task 12 review round 1: the only entry point into `qc.release`
          ("firma final" per Blueprint Section 8) — gated to director_tecnico
          at the `calidad` stage, matching the guard `liberar/page.tsx` itself
          re-checks server-side. */}
      {user.role === "director_tecnico" && order.status === "calidad" && (
        <Button render={<Link href={`/produccion/${order.id}/liberar`}>Liberar lote</Link>} />
      )}
      {/* Final review (Important 4): entry point into `qc.reject`, same gate. */}
      {user.role === "director_tecnico" && order.status === "calidad" && (
        <Button
          variant="destructive"
          render={<Link href={`/produccion/${order.id}/rechazar`}>Rechazar lote</Link>}
        />
      )}
      {/* Task 13 review round 1 (Critical finding fix): entry point into
          `deviations.create` — gated client-side to the same roles
          `deviations.create`'s `roleProcedure` allows server-side
          (`nueva/page.tsx` re-checks this, same pattern as `liberar/page.tsx`). */}
      {["calidad", "jefe_planta", "operario"].includes(user.role) && (
        <Button
          variant="outline"
          render={<Link href={`/produccion/${order.id}/desviacion/nueva`}>Reportar desviación</Link>}
        />
      )}

      <div className="flex flex-col gap-3">
        <h2 className="font-sans text-lg font-semibold text-foreground">Eventos del lote</h2>
        <EventTimeline events={order.events} />
      </div>
    </div>
  );
}
