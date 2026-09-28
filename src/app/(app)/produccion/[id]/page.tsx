import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { StageTracker } from "@/components/batch/StageTracker";
import { EventTimeline } from "@/components/batch/EventTimeline";
import { OfflineIndicator } from "@/components/layout/OfflineIndicator";

export default async function BatchRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const order = await withTenant(user.tenantId, (tx) =>
    tx.productionOrder.findUniqueOrThrow({
      where: { id },
      include: {
        formula: true,
        events: true,
        signatures: true,
        deviations: true,
      },
    }),
  );

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

      <div className="flex flex-col gap-3">
        <h2 className="font-sans text-lg font-semibold text-foreground">Eventos del lote</h2>
        <EventTimeline events={order.events} />
      </div>
    </div>
  );
}
