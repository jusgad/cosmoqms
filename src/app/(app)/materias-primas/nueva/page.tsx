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
    tx.rawMaterial.findMany({ orderBy: { name: "asc" }, select: { id: true, code: true, name: true } }),
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-sans text-2xl font-semibold text-foreground">Recibir lote de materia prima</h1>
      <ReceiveLotForm materials={materials} />
    </div>
  );
}
