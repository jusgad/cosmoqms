import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { FormulaForm } from "@/components/forms/FormulaForm";

export default async function NuevaFormulaPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== "jefe_planta") {
    redirect("/formulas");
  }

  const materials = await withTenant(user.tenantId, user.id, (tx) =>
    tx.rawMaterial.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true } }),
  );

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-sans text-2xl font-semibold text-foreground">Nueva fórmula maestra</h1>
      <FormulaForm materials={materials} />
    </div>
  );
}
