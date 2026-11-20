import Link from "next/link";
import { BookOpen, CircleCheck, CircleAlert } from "lucide-react";
import { withTenant } from "@/lib/db";
import { MODULE_ROLES, requirePageRole } from "@/lib/pageAccess";
import { listSops } from "@/lib/sops/service";
import { SOP_EDIT_ROLES } from "@/lib/validation/sops";
import { Button } from "@/components/ui/button";

const dateFmt = (date: Date | null) => (date ? date.toLocaleDateString("es-CO", { timeZone: "UTC" }) : "—");

export default async function SopsPage() {
  const user = await requirePageRole(MODULE_ROLES.sops);
  const canEdit = (SOP_EDIT_ROLES as readonly string[]).includes(user.role);
  const all = await withTenant(user.tenantId, user.id, (tx) => listSops(tx, user.tenantId, user.id));
  // Drafts are the quality unit's work in progress; the floor only sees
  // procedures that are in force.
  const sops = canEdit ? all : all.filter((sop) => sop.vigente);
  const pending = sops.filter((sop) => sop.vigente && !sop.vigente.acknowledged).length;
  const today = new Date();

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-sans text-2xl font-semibold text-foreground">SOPs</h1>
          <p className="text-sm text-muted-foreground">
            Procedimientos operativos estándar vigentes.{" "}
            {pending === 0 ? "Está al día con todas las lecturas." : `Tiene ${pending} pendiente(s) de leer.`}
          </p>
        </div>
        {canEdit && <Button render={<Link href="/sops/nuevo">Nuevo SOP</Link>} />}
      </div>

      {sops.length === 0 ? (
        <div className="rounded-card border border-border bg-card p-6 text-sm text-muted-foreground">
          Todavía no hay procedimientos registrados.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {sops.map((sop) => {
            const target = sop.vigente?.id ?? sop.draft?.id;
            const overdue = sop.vigente?.reviewDue ? sop.vigente.reviewDue < today : false;
            return (
              <li key={sop.code}>
                <Link
                  href={`/sops/${target}`}
                  className="flex flex-col gap-2 rounded-card border border-border bg-card p-4 transition-colors hover:border-primary focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex min-w-0 gap-3">
                    <BookOpen className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="font-mono text-xs text-muted-foreground">
                        {sop.code}
                        {sop.vigente ? ` · v${sop.vigente.version}` : " · sin versión vigente"}
                      </span>
                      <span className="font-sans text-sm font-semibold text-foreground">{sop.title}</span>
                      {sop.vigente && (
                        <span className={overdue ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                          Vigente desde {dateFmt(sop.vigente.effectiveDate)} · revisión{" "}
                          {overdue ? "vencida el" : "el"} {dateFmt(sop.vigente.reviewDue)}
                        </span>
                      )}
                      {canEdit && sop.draft && (
                        <span className="text-xs text-pending">Borrador v{sop.draft.version} en preparación</span>
                      )}
                    </div>
                  </div>
                  {sop.vigente &&
                    (sop.vigente.acknowledged ? (
                      <span className="flex shrink-0 items-center gap-1 text-sm text-success">
                        <CircleCheck className="size-4" aria-hidden />
                        Leído
                      </span>
                    ) : (
                      <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-pending">
                        <CircleAlert className="size-4" aria-hidden />
                        Pendiente de leer
                      </span>
                    ))}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
