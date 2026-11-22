import { MODULE_ROLES, requirePageRole } from "@/lib/pageAccess";
import { AuditLogView } from "@/app/(app)/auditoria/AuditLogView";

// Server Component doing the auth/role gate (same pattern as
// trazabilidad/page.tsx, calidad/page.tsx) — the route stays server-rendered
// and redirects unauthorized/unauthenticated users before any client JS
// ships. This mirrors `auditRouter`'s own `roleProcedure("admin",
// "director_tecnico")` gate — never the only enforcement, same reasoning as
// every other gated page in this codebase.
export default async function AuditoriaPage() {
  await requirePageRole(MODULE_ROLES.auditoria);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-sans text-2xl font-semibold text-foreground">Auditoría</h1>
      <p className="text-sm text-muted-foreground">
        Historial de cambios sobre tablas reguladas (órdenes de producción, eventos de lote,
        resultados de QC, desviaciones y lotes de producto terminado).
      </p>
      <AuditLogView />
    </div>
  );
}
