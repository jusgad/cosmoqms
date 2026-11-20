import { withTenant } from "@/lib/db";
import { requirePageRole } from "@/lib/pageAccess";
import { SOP_EDIT_ROLES } from "@/lib/validation/sops";
import { SopDraftForm } from "@/app/(app)/sops/nuevo/SopDraftForm";

// `?codigo=SOP-001` starts the next version of an existing procedure.
export default async function NuevoSopPage({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  const user = await requirePageRole(SOP_EDIT_ROLES);
  const { codigo } = await searchParams;

  const latest = codigo
    ? await withTenant(user.tenantId, user.id, (tx) =>
        tx.sop.findFirst({ where: { tenantId: user.tenantId, code: codigo }, orderBy: { version: "desc" } }),
      )
    : null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-sans text-2xl font-semibold text-foreground">
        {latest ? `Nueva versión de ${latest.code}` : "Nuevo SOP"}
      </h1>
      <p className="max-w-lg text-sm text-muted-foreground">
        Se crea como borrador. Después adjunta el documento en PDF y el director técnico lo aprueba con su firma
        electrónica; desde ese momento es la versión vigente
        {latest ? ` y la versión ${latest.version} queda obsoleta` : ""}.
      </p>
      <SopDraftForm initialCode={latest?.code ?? ""} initialTitle={latest?.title ?? ""} />
    </div>
  );
}
