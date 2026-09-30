import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { SignaturePad } from "@/components/batch/SignaturePad";

// Only stages that actually have a meaning statement (i.e. a completed
// production stage awaiting attestation) can be signed. "planificado" has
// nothing to confirm yet, and "liberado"/"rechazado" are terminal QC
// verdicts made by Task 12/13's own procedures, not this generic signature.
const SIGNABLE_STAGES = new Set(["pesado", "mezclado", "envasado", "calidad"]);

export default async function FirmaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const order = await withTenant(user.tenantId, user.id, (tx) =>
    tx.productionOrder.findUniqueOrThrow({ where: { id } }),
  );

  if (!SIGNABLE_STAGES.has(order.status)) {
    redirect(`/produccion/${order.id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-sans text-2xl font-semibold text-foreground">
        Firma electrónica — {order.orderNumber} ({order.status})
      </h1>
      <SignaturePad productionOrderId={order.id} stage={order.status} />
    </div>
  );
}
