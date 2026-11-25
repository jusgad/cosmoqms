import Link from "next/link";
import { MODULE_ROLES, requirePageRole } from "@/lib/pageAccess";
import { withTenant } from "@/lib/db";
import { pageArgs, pageFromParam } from "@/lib/pagination";
import { Pagination } from "@/components/layout/Pagination";

const STATUS_LABEL: Record<string, string> = {
  abierta: "Abierta",
  en_investigacion: "En investigación",
  pendiente_aprobacion: "Pendiente de aprobación",
  cerrada: "Cerrada",
};

// Server Component reading direct from Prisma (the project's data-flow convention),
// same pattern as calidad/page.tsx (Task 12): lists deviations that are still
// open (`status !== "cerrada"`) — the same population `qc.release`'s guard
// (Task 12) checks before allowing a batch to be released.
export default async function DesviacionesPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const user = await requirePageRole(MODULE_ROLES.desviaciones);
  const page = pageFromParam((await searchParams).pagina);
  const where = { tenantId: user.tenantId, status: { not: "cerrada" as const } };

  const [deviations, total] = await withTenant(user.tenantId, user.id, (tx) =>
    Promise.all([
      tx.deviation.findMany({
        where,
        // Newest orders first; `id` keeps the order stable between pages.
        orderBy: [{ order: { orderNumber: "desc" } }, { id: "asc" }],
        include: { order: true },
        ...pageArgs(page),
      }),
      tx.deviation.count({ where }),
    ]),
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
      <Pagination page={page} total={total} basePath="/calidad/desviaciones" />
    </div>
  );
}
