import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { ReceiveLotForm } from "@/components/forms/ReceiveLotForm";

export default async function NuevaMateriaPrimaPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== "bodega") {
    redirect("/materias-primas");
  }

  const materials = await withTenant(user.tenantId, user.id, (tx) =>
    tx.rawMaterial.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true } }),
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-sans text-2xl font-semibold text-foreground">Recibir lote de materia prima</h1>
      {materials.length === 0 ? (
        <p className="rounded-card border border-border bg-card p-4 text-sm text-foreground">
          Antes de recibir un lote, agregue la materia prima al{" "}
          <Link href="/materias-primas/catalogo" className="font-medium text-primary underline-offset-4 hover:underline">
            catálogo
          </Link>
          .
        </p>
      ) : (
        <ReceiveLotForm materials={materials} />
      )}
    </div>
  );
}
