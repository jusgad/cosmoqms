import Link from "next/link";
import { Check, Minus } from "lucide-react";
import type { Role } from "@prisma/client";
import { MODULE_ROLES, requirePageRole } from "@/lib/pageAccess";
import { withTenant } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { CAPABILITIES, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_ORDER } from "@/lib/roles/permissions";

// Administrator's view of the role model: what each role does and how many
// active people hold it. Roles are assigned per person in /usuarios; the
// permissions themselves are fixed by BPM separation of duties and enforced
// on the server, so this screen documents them rather than editing them.
export default async function RolesPage() {
  const user = await requirePageRole(MODULE_ROLES.roles);

  const counts = await withTenant(user.tenantId, user.id, (tx) =>
    tx.user.groupBy({ by: ["role"], where: { tenantId: user.tenantId, active: true }, _count: { _all: true } }),
  );
  const activeByRole = new Map<Role, number>(counts.map((row) => [row.role, row._count._all]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-sans text-2xl font-semibold text-foreground">Roles y permisos</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Qué puede hacer cada rol en CosmoQMS. Los permisos siguen la separación de funciones de BPM y los valida el
            servidor en cada acción. El rol de cada persona se asigna en Usuarios.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/usuarios">Asignar roles</Link>} />
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ROLE_ORDER.map((role) => (
          <li key={role} className="flex flex-col gap-1 rounded-card border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">{ROLE_LABELS[role]}</h2>
              <span className="font-mono text-xs text-muted-foreground">{activeByRole.get(role) ?? 0} activo(s)</span>
            </div>
            <p className="text-sm text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
          </li>
        ))}
      </ul>

      <div className="overflow-x-auto rounded-card border border-border bg-card">
        <table className="w-full min-w-[56rem] text-sm">
          <caption className="sr-only">Permisos por rol</caption>
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th scope="col" className="px-4 py-3 font-medium">
                Acción
              </th>
              {ROLE_ORDER.map((role) => (
                <th key={role} scope="col" className="px-2 py-3 text-center font-medium">
                  {ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>
          {CAPABILITIES.map((group) => (
            <tbody key={group.module}>
              <tr className="border-b border-border bg-muted/50">
                <th colSpan={ROLE_ORDER.length + 1} scope="colgroup" className="px-4 py-2 text-left text-xs font-semibold text-foreground">
                  {group.module}
                </th>
              </tr>
              {group.capabilities.map((capability) => (
                <tr key={capability.action} className="border-b border-border last:border-b-0">
                  <th scope="row" className="px-4 py-2 text-left font-normal text-foreground">
                    {capability.action}
                  </th>
                  {ROLE_ORDER.map((role) => (
                    <td key={role} className="px-2 py-2 text-center">
                      {capability.roles.includes(role) ? (
                        <>
                          <Check className="mx-auto size-4 text-success" aria-hidden />
                          <span className="sr-only">Sí</span>
                        </>
                      ) : (
                        <>
                          <Minus className="mx-auto size-4 text-muted-foreground/50" aria-hidden />
                          <span className="sr-only">No</span>
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
