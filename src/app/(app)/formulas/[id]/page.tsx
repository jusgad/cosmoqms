import Link from "next/link";
import { notFound } from "next/navigation";
import { MODULE_ROLES, requirePageRole } from "@/lib/pageAccess";
import { withTenant } from "@/lib/db";
import { FormulaStatusBadge } from "@/components/formulas/FormulaStatusBadge";
import { FormulaActivateAction } from "@/components/formulas/FormulaActivateAction";
import { QcSpecificationEditor, type SpecRow } from "@/components/formulas/QcSpecificationEditor";
import { DraftIngredientsEditor } from "@/components/formulas/DraftIngredientsEditor";
import { NewFormulaVersionButton } from "@/components/formulas/NewFormulaVersionButton";
import { formatRange } from "@/lib/quality/formatSpec";

export default async function FormulaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageRole(MODULE_ROLES.formulas);

  const formula = await withTenant(user.tenantId, user.id, (tx) =>
    tx.masterFormula.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        ingredients: { include: { rawMaterial: true }, orderBy: { orderIndex: "asc" } },
        qcSpecifications: { orderBy: { parameter: "asc" } },
      },
    }),
  );

  if (!formula) {
    notFound();
  }

  const isDraft = formula.status === "draft";
  const canEditIngredients = user.role === "jefe_planta" && isDraft;
  const canActivate = user.role === "calidad" && isDraft;
  // Quality defines the acceptance criteria, and only on a draft (the server
  // enforces both again in formulas.addSpecification/removeSpecification).
  const canEditSpecs = user.role === "calidad" && isDraft;
  const canCreateVersion = user.role === "jefe_planta" && formula.status === "active";

  const [versions, materials] = await withTenant(user.tenantId, user.id, (tx) =>
    Promise.all([
      tx.masterFormula.findMany({
        where: { tenantId: user.tenantId, code: formula.code },
        orderBy: { version: "desc" },
        select: { id: true, version: true, status: true, approvedAt: true },
      }),
      canEditIngredients
        ? tx.rawMaterial.findMany({ where: { tenantId: user.tenantId }, orderBy: { code: "asc" } })
        : Promise.resolve([]),
    ]),
  );
  const nextVersion = (versions[0]?.version ?? formula.version) + 1;

  const total = formula.ingredients.reduce((sum, ingredient) => sum + Number(ingredient.percentage), 0);
  const specs: SpecRow[] = formula.qcSpecifications.map((spec) => ({
    id: spec.id,
    parameter: spec.parameter,
    minValue: spec.minValue === null ? null : Number(spec.minValue),
    maxValue: spec.maxValue === null ? null : Number(spec.maxValue),
    unit: spec.unit,
  }));

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
        {canEditIngredients ? (
          <DraftIngredientsEditor
            formulaId={formula.id}
            ingredients={formula.ingredients.map((ingredient) => ({
              id: ingredient.id,
              materialLabel: `${ingredient.rawMaterial.code} — ${ingredient.rawMaterial.name}`,
              percentage: Number(ingredient.percentage),
            }))}
            materials={materials.map((material) => ({ id: material.id, label: `${material.code} — ${material.name}` }))}
          />
        ) : (
          <>
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
          </>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Especificaciones de calidad</h2>
          <p className="text-xs text-muted-foreground">
            Rangos contra los que calidad evalúa cada lote. Solo se cambian mientras la fórmula está en borrador.
          </p>
        </div>
        {canEditSpecs ? (
          <QcSpecificationEditor formulaId={formula.id} specs={specs} />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {specs.map((spec) => (
              <li key={spec.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-foreground">{spec.parameter}</span>
                <span className="font-mono text-muted-foreground">{formatRange(spec)}</span>
              </li>
            ))}
            {specs.length === 0 && <li className="py-2 text-sm text-muted-foreground">Sin especificaciones registradas.</li>}
          </ul>
        )}
      </div>

      {canActivate && <FormulaActivateAction formulaId={formula.id} />}
      {canCreateVersion && <NewFormulaVersionButton formulaId={formula.id} nextVersion={nextVersion} />}

      {versions.length > 1 && (
        <div className="flex flex-col gap-2 rounded-card border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Historial de versiones</h2>
          <ul className="flex flex-col divide-y divide-border">
            {versions.map((version) => (
              <li key={version.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                {version.id === formula.id ? (
                  <span className="font-mono font-medium text-foreground">Versión {version.version} (esta)</span>
                ) : (
                  <Link href={`/formulas/${version.id}`} className="font-mono text-primary underline-offset-4 hover:underline">
                    Versión {version.version}
                  </Link>
                )}
                <span className="flex items-center gap-2">
                  {version.approvedAt && (
                    <span className="text-xs text-muted-foreground">
                      aprobada {version.approvedAt.toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}
                    </span>
                  )}
                  <FormulaStatusBadge status={version.status} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
