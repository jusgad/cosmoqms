import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { QcDecisionPad } from "@/components/quality/QcDecisionPad";

// Same shape as firma/page.tsx (Task 11): a Server Component gate that
// re-checks role and stage server-side before rendering the client
// component — the "Liberar lote" link on the order detail page is a
// convenience, never the actual authorization boundary.
export default async function LiberarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const order = await withTenant(user.tenantId, user.id, (tx) =>
    tx.productionOrder.findFirst({ where: { id, tenantId: user.tenantId } }),
  );
  if (!order) {
    notFound();
  }

  if (user.role !== "director_tecnico" || order.status !== "calidad") {
    redirect(`/produccion/${order.id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-sans text-2xl font-semibold text-foreground">
        Liberación de lote — {order.orderNumber}
      </h1>
      <QcDecisionPad productionOrderId={order.id} decision="release" />
    </div>
  );
}
