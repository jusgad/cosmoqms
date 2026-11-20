import { withTenant } from "@/lib/db";
import { MODULE_ROLES, requirePageRole } from "@/lib/pageAccess";
import { OrganizationForm } from "@/app/(app)/configuracion/OrganizationForm";

// Admin settings: company data printed on the BPM report and batch records.
// Business rules such as the formula tolerance (100% ± 0.5) stay fixed in
// code on purpose: changing them is a validated change, not a setting.
export default async function ConfiguracionPage() {
  const user = await requirePageRole(MODULE_ROLES.configuracion);
  const organization = await withTenant(user.tenantId, user.id, (tx) =>
    tx.organization.findFirstOrThrow({
      where: { id: user.tenantId },
      select: { name: true, nit: true, invimaRegistration: true },
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-sans text-2xl font-semibold text-foreground">Configuración</h1>
        <p className="max-w-lg text-sm text-muted-foreground">
          Datos de la empresa que aparecen en el reporte BPM y en los registros de lote.
        </p>
      </div>
      <OrganizationForm initial={organization} />
      <section className="flex max-w-lg flex-col gap-2 rounded-card border border-border bg-card p-4 text-sm">
        <h2 className="font-sans text-base font-semibold text-foreground">Reglas fijas del sistema</h2>
        <p className="text-muted-foreground">
          Tolerancia de fórmulas: 100% ± 0,5%. Firma electrónica con reautenticación. Estas reglas no se
          cambian desde aquí: modificarlas es un cambio validado del sistema (control de cambios BPM).
        </p>
      </section>
    </div>
  );
}
