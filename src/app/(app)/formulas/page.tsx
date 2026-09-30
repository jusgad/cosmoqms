import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { FormulaStatusBadge } from "@/components/formulas/FormulaStatusBadge";

export default async function FormulasPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const formulas = await withTenant(user.tenantId, user.id, (tx) =>
    tx.masterFormula.findMany({ orderBy: { name: "asc" } }),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-sans text-2xl font-semibold text-foreground">Fórmulas Maestras</h1>
        {user.role === "jefe_planta" && (
          <Button render={<Link href="/formulas/nueva">Nueva fórmula</Link>} />
        )}
      </div>

      <div className="overflow-x-auto rounded-card border border-border bg-card">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="h-11 px-4 text-left font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Código
              </th>
              <th className="h-11 px-4 text-left font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Nombre
              </th>
              <th className="h-11 px-4 text-left font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Versión
              </th>
              <th className="h-11 px-4 text-left font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Estado
              </th>
              <th className="h-11 px-4" />
            </tr>
          </thead>
          <tbody>
            {formulas.map((formula) => (
              <tr key={formula.id} className="border-b border-border last:border-0 hover:bg-muted">
                <td className="px-4 py-3 font-mono">{formula.code}</td>
                <td className="px-4 py-3">{formula.name}</td>
                <td className="px-4 py-3 font-mono">v{formula.version}</td>
                <td className="px-4 py-3">
                  <FormulaStatusBadge status={formula.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/formulas/${formula.id}`}
                    className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-primary hover:underline"
                  >
                    Ver detalle
                  </Link>
                </td>
              </tr>
            ))}
            {formulas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Sin fórmulas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
