import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, TriangleAlert } from "lucide-react";
import { MODULE_ROLES, requirePageRole } from "@/lib/pageAccess";
import { withTenant } from "@/lib/db";
import { listUsers } from "@/lib/users/admin";
import { buildAccessReview, INACTIVITY_DAYS } from "@/lib/users/accessReview";
import { loadSignIns } from "@/lib/users/clerkSignIns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Periodic access review for the administrator: every account with its role,
// MFA and last sign-in, and the findings to act on (no MFA, inactive for too
// long, never signed in). Downloadable as CSV to keep as review evidence.
export default async function AccessReviewPage() {
  const user = await requirePageRole(MODULE_ROLES.usuarios);
  const users = await withTenant(user.tenantId, user.id, (tx) => listUsers(tx, user.tenantId));
  const { signIns, available } = await loadSignIns(users.map((row) => row.id));
  const rows = buildAccessReview(users, signIns);
  const withFindings = rows.filter((row) => row.findings.length > 0).length;

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-sans text-2xl font-semibold text-foreground">Revisión de accesos</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Revise cada cuenta al menos cada tres meses: que el rol corresponda al cargo, que tenga MFA y que se desactive
            a quien ya no trabaja en el laboratorio. {withFindings} cuenta(s) con hallazgos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <Link href="/usuarios">
                <ArrowLeft aria-hidden />
                Usuarios
              </Link>
            }
          />
          <Button
            nativeButton={false}
            render={
              <a href="/api/reports/accesos">
                <FileSpreadsheet aria-hidden />
                Descargar CSV
              </a>
            }
          />
        </div>
      </div>

      {!available && (
        <p className="rounded-card border border-border bg-muted p-3 text-sm text-foreground">
          No se pudo consultar el último ingreso en Clerk. El MFA se muestra según el último dato registrado.
        </p>
      )}

      <div className="overflow-x-auto rounded-card border border-border bg-card">
        <table className="w-full min-w-[48rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Persona</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">MFA</th>
              <th className="px-4 py-3 font-medium">Último ingreso</th>
              <th className="px-4 py-3 font-medium">Hallazgos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={cn("border-b border-border last:border-b-0", !row.active && "opacity-70")}>
                <td className="px-4 py-2">
                  <span className="block text-foreground">{row.fullName}</span>
                  <span className="block font-mono text-xs text-muted-foreground">{row.email}</span>
                </td>
                <td className="px-4 py-2 text-foreground">{row.roleLabel}</td>
                <td className="px-4 py-2 text-foreground">{row.active ? "Activo" : "Inactivo"}</td>
                <td className="px-4 py-2 text-foreground">{row.mfa ? "Sí" : "No"}</td>
                <td className="px-4 py-2 font-mono text-xs text-foreground">
                  {row.lastSignInAt ? row.lastSignInAt.toLocaleString("es-CO", { timeZone: "America/Bogota" }) : "—"}
                </td>
                <td className="px-4 py-2">
                  {row.findings.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Sin hallazgos</span>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {row.findings.map((finding) => (
                        <li key={finding} className="flex items-center gap-1 text-xs text-pending">
                          <TriangleAlert className="size-3.5" aria-hidden />
                          {finding}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Se marca como hallazgo una cuenta activa sin MFA, que nunca ha ingresado o que no ingresa hace más de{" "}
        {INACTIVITY_DAYS} días. Las cuentas inactivas se listan para dejar constancia.
      </p>
    </div>
  );
}
