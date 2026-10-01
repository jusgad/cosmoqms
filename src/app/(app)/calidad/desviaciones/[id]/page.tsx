import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { DeviationForm } from "@/components/quality/DeviationForm";

// Server Component gate (same shape as produccion/[id]/liberar/page.tsx,
// Task 12): re-reads the deviation and the current user's role server-side
// before rendering the client component — the page itself doesn't restrict
// who can view, but the "Aprobar" gate (server AND client) restricts who can
// mutate.
export default async function DesviacionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const deviation = await withTenant(user.tenantId, user.id, (tx) =>
    tx.deviation.findFirst({ where: { id, tenantId: user.tenantId }, include: { order: true } }),
  );
  if (!deviation) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-sans text-2xl font-semibold text-foreground">
        Desviación — {deviation.order.orderNumber}
      </h1>
      <p className="text-sm text-muted-foreground">{deviation.description}</p>
      <DeviationForm
        deviation={{
          id: deviation.id,
          description: deviation.description,
          investigation: deviation.investigation,
          correctiveAction: deviation.correctiveAction,
          status: deviation.status,
        }}
        userRole={user.role}
      />
    </div>
  );
}
