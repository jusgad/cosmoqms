import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { FormulaStatusBadge } from "@/components/formulas/FormulaStatusBadge";
import { FormulaActivateAction } from "@/components/formulas/FormulaActivateAction";

export default async function FormulaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const formula = await withTenant(user.tenantId, (tx) =>
    tx.masterFormula.findUnique({
      where: { id },
      include: { ingredients: { include: { rawMaterial: true }, orderBy: { orderIndex: "asc" } } },
    }),
  );

  if (!formula) {
    notFound();
  }

  const total = formula.ingredients.reduce((sum, ingredient) => sum + Number(ingredient.percentage), 0);
  const canActivate = user.role === "calidad" && formula.status === "draft";

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-sans text-2xl font-semibold text-foreground">
            {formula.code} — {formula.name}
          </h1>
          <p className="font-mono text-sm text-muted-foreground">Versión {formula.version}</p>
        </div>
        <FormulaStatusBadge status={formula.status} />
      </div>

      <div className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Ingredientes</h2>
          <span className="font-mono text-sm font-medium text-foreground">Total: {total.toFixed(2)}%</span>
        </div>
        <ul className="flex flex-col divide-y divide-border">
          {formula.ingredients.map((ingredient) => (
            <li key={ingredient.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-foreground">
                {ingredient.rawMaterial.code} — {ingredient.rawMaterial.name}
              </span>
              <span className="font-mono text-muted-foreground">{Number(ingredient.percentage).toFixed(2)}%</span>
            </li>
          ))}
          {formula.ingredients.length === 0 && (
            <li className="py-2 text-sm text-muted-foreground">Sin ingredientes registrados.</li>
          )}
        </ul>
      </div>

      {canActivate && <FormulaActivateAction formulaId={formula.id} />}
    </div>
  );
}
