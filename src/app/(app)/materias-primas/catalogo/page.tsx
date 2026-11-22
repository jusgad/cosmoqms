import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MODULE_ROLES, requirePageRole } from "@/lib/pageAccess";
import { withTenant } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { RawMaterialForm } from "@/app/(app)/materias-primas/catalogo/RawMaterialForm";
import { RawMaterialRow, type CatalogRow } from "@/app/(app)/materias-primas/catalogo/RawMaterialRow";

// The raw-material catalog: WHAT can be received and used in formulas (the
// material itself), as opposed to the received lots listed in /materias-primas.
// Everyone in the module can read it; bodega maintains it (the tRPC
// procedures re-check the role).
export default async function CatalogoPage() {
  const user = await requirePageRole(MODULE_ROLES.materiasPrimas);
  const canEdit = user.role === "bodega";

  const materials = await withTenant(user.tenantId, user.id, (tx) =>
    tx.rawMaterial.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { code: "asc" },
      include: { _count: { select: { lots: true, ingredients: true } } },
    }),
  );

  const rows: CatalogRow[] = materials.map((material) => ({
    id: material.id,
    code: material.code,
    name: material.name,
    unit: material.unit,
    category: material.category,
    lots: material._count.lots,
    formulas: material._count.ingredients,
  }));

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-sans text-2xl font-semibold text-foreground">Catálogo de materias primas</h1>
          <p className="text-sm text-muted-foreground">
            Las materias primas que el laboratorio puede recibir y usar en sus fórmulas.
          </p>
        </div>
        <Button
          variant="outline"
          nativeButton={false}
          render={
            <Link href="/materias-primas">
              <ArrowLeft aria-hidden />
              Lotes recibidos
            </Link>
          }
        />
      </div>

      {canEdit && <RawMaterialForm />}

      <div className="overflow-x-auto rounded-card border border-border bg-card">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Unidad</th>
              <th className="px-4 py-3 font-medium">Categoría</th>
              <th className="px-4 py-3 font-medium">Uso</th>
              {canEdit && <th className="px-4 py-3 font-medium sr-only">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <RawMaterialRow key={row.id} row={row} canEdit={canEdit} />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 6 : 5} className="px-4 py-6 text-center text-muted-foreground">
                  Todavía no hay materias primas en el catálogo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
