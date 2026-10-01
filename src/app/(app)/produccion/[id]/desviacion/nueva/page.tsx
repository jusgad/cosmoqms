import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { ReportDeviationForm } from "@/components/quality/ReportDeviationForm";

// Server Component gate (same shape as produccion/[id]/liberar/page.tsx,
// Task 12): re-checks role server-side before rendering the client
// component — the "Reportar desviación" link on the batch record page is a
// convenience, never the actual authorization boundary (`deviations.create`'s
// own `roleProcedure("calidad", "jefe_planta", "operario")` is that boundary).
export default async function NuevaDesviacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (!["calidad", "jefe_planta", "operario"].includes(user.role)) {
    redirect(`/produccion/${id}`);
  }

  const order = await withTenant(user.tenantId, user.id, (tx) =>
    tx.productionOrder.findFirst({ where: { id, tenantId: user.tenantId } }),
  );
  if (!order) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-sans text-2xl font-semibold text-foreground">
        Reportar desviación — {order.orderNumber}
      </h1>
      <ReportDeviationForm productionOrderId={order.id} />
    </div>
  );
}
