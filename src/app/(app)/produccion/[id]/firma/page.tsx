import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { SignaturePad } from "@/components/batch/SignaturePad";
import { isSignableStage, STAGE_SIGNER_ROLES } from "@/lib/validation/production";

// Server Component gate: only a stage that is actually signable (a completed
// production stage awaiting attestation — never "planificado" or the terminal
// "liberado"/"rechazado" QC decisions), and only by a role allowed to sign
// THAT stage (final review, Important 6). `production.sign` enforces both
// server-side; this just avoids rendering a pad that could only fail.
export default async function FirmaPage({ params }: { params: Promise<{ id: string }> }) {
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

  const stage = order.status;
  if (!isSignableStage(stage) || !STAGE_SIGNER_ROLES[stage].includes(user.role)) {
    redirect(`/produccion/${order.id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-sans text-2xl font-semibold text-foreground">
        Firma electrónica — {order.orderNumber} ({stage})
      </h1>
      <SignaturePad productionOrderId={order.id} stage={stage} />
    </div>
  );
}
