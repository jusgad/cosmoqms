import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";

const STATUS_LABEL: Record<string, string> = {
  abierta: "Abierta",
  en_investigacion: "En investigación",
  pendiente_aprobacion: "Pendiente de aprobación",
  cerrada: "Cerrada",
};

// Server Component reading direct from Prisma (CLAUDE.md's Data Flow rule),
// same pattern as calidad/page.tsx (Task 12): lists deviations that are still
// open (`status !== "cerrada"`) — the same population `qc.release`'s guard
// (Task 12) checks before allowing a batch to be released.
export default async function DesviacionesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const deviations = await withTenant(user.tenantId, user.id, (tx) =>
    tx.deviation.findMany({
      where: { tenantId: user.tenantId, status: { not: "cerrada" } },
      orderBy: { id: "asc" },
      include: { order: true },
    }),
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-sans text-2xl font-semibold text-foreground">Desviaciones</h1>

      <div className="overflow-x-auto rounded-card border border-border bg-card">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="h-11 px-4 text-left font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Orden
              </th>
              <th className="h-11 px-4 text-left font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Descripción
              </th>
              <th className="h-11 px-4 text-left font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Estado
              </th>
              <th className="h-11 px-4 text-right font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Acción
              </th>
            </tr>
          </thead>
          <tbody>
            {deviations.map((deviation) => (
              <tr key={deviation.id} className="border-b border-border last:border-0 hover:bg-muted">
                <td className="px-4 py-3 font-mono">{deviation.order.orderNumber}</td>
                <td className="px-4 py-3">{deviation.description}</td>
                <td className="px-4 py-3">{STATUS_LABEL[deviation.status] ?? deviation.status}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/calidad/desviaciones/${deviation.id}`}
                    className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-primary hover:underline"
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
            {deviations.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No hay desviaciones abiertas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
