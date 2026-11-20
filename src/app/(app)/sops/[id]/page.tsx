import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { TRPCError } from "@trpc/server";
import { withTenant } from "@/lib/db";
import { cn } from "@/lib/utils";
import { MODULE_ROLES, requirePageRole } from "@/lib/pageAccess";
import { getSopDetail } from "@/lib/sops/service";
import { listAttachments } from "@/lib/attachments/service";
import { SOP_APPROVE_ROLES, SOP_EDIT_ROLES, SOP_STATUS_LABELS } from "@/lib/validation/sops";
import { AttachmentList } from "@/components/attachments/AttachmentList";
import { AttachmentUploader } from "@/components/attachments/AttachmentUploader";
import { Button } from "@/components/ui/button";
import { SopApprovalPad } from "@/app/(app)/sops/[id]/SopApprovalPad";
import { AcknowledgeButton } from "@/app/(app)/sops/[id]/AcknowledgeButton";
import { SopCoverage } from "@/app/(app)/sops/[id]/SopCoverage";

const STATUS_CLASSES = {
  borrador: "border-pending/30 bg-pending/10 text-pending",
  vigente: "border-success/30 bg-success/10 text-success",
  obsoleto: "border-border bg-transparent text-muted-foreground",
} as const;

const dateFmt = (date: Date | null) => (date ? date.toLocaleDateString("es-CO", { timeZone: "UTC" }) : "—");

export default async function SopDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageRole(MODULE_ROLES.sops);
  const canEdit = (SOP_EDIT_ROLES as readonly string[]).includes(user.role);
  const canApprove = (SOP_APPROVE_ROLES as readonly string[]).includes(user.role);

  const data = await withTenant(user.tenantId, user.id, async (tx) => {
    try {
      const detail = await getSopDetail(tx, user.tenantId, id, user.id);
      const documents = await listAttachments(tx, user.tenantId, "sop", id);
      return { ...detail, documents };
    } catch (error) {
      if (error instanceof TRPCError && error.code === "NOT_FOUND") return null;
      throw error;
    }
  });
  if (!data) notFound();

  const { sop, versions, documents } = data;
  // Drafts are the quality unit's work in progress, not floor documents.
  if (sop.status === "borrador" && !canEdit) redirect("/sops");

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/sops" className="text-sm font-medium text-primary hover:underline">
          ← SOPs
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-sans text-2xl font-semibold text-foreground">{sop.title}</h1>
          <span className={cn("rounded-lg border px-2 py-0.5 text-xs font-medium", STATUS_CLASSES[sop.status])}>
            {SOP_STATUS_LABELS[sop.status]}
          </span>
        </div>
        <p className="font-mono text-sm text-muted-foreground">
          {sop.code} · versión {sop.version}
        </p>
      </div>

      <dl className="grid gap-4 rounded-card border border-border bg-card p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Elaborado por</dt>
          <dd className="text-foreground">{data.createdByName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Aprobado por</dt>
          <dd className="text-foreground">
            {data.approvedByName ? `${data.approvedByName} · ${sop.approvedAt?.toLocaleString("es-CO")}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Vigente desde</dt>
          <dd className="font-mono text-foreground">{dateFmt(sop.effectiveDate)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Próxima revisión</dt>
          <dd className="font-mono text-foreground">{dateFmt(sop.reviewDue)}</dd>
        </div>
        {sop.changeSummary && (
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Cambios de esta versión</dt>
            <dd className="whitespace-pre-line text-foreground">{sop.changeSummary}</dd>
          </div>
        )}
      </dl>

      <section aria-labelledby="doc-title" className="flex flex-col gap-3">
        <h2 id="doc-title" className="font-sans text-lg font-semibold text-foreground">
          Documento
        </h2>
        <AttachmentList items={documents} emptyText="Este procedimiento aún no tiene documento adjunto." />
        {canEdit && sop.status === "borrador" && (
          <AttachmentUploader entityType="sop" entityId={sop.id} label="Adjuntar documento del procedimiento (PDF)" />
        )}
      </section>

      {sop.status === "vigente" &&
        (data.acknowledgedByMe ? (
          <p className="flex items-center gap-2 text-sm text-success">
            <CircleCheck className="size-4" aria-hidden />
            Usted ya confirmó la lectura de esta versión.
          </p>
        ) : (
          <AcknowledgeButton sopId={sop.id} />
        ))}

      {canApprove && sop.status === "borrador" && <SopApprovalPad sopId={sop.id} hasDocument={documents.length > 0} />}

      {canEdit && sop.status === "vigente" && <SopCoverage rows={data.coverage} />}

      <section aria-labelledby="versions-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="versions-title" className="font-sans text-lg font-semibold text-foreground">
            Historial de versiones
          </h2>
          {canEdit && !versions.some((version) => version.status === "borrador") && (
            <Button variant="outline" render={<Link href={`/sops/nuevo?codigo=${encodeURIComponent(sop.code)}`}>Nueva versión</Link>} />
          )}
        </div>
        <ul className="flex flex-col gap-2">
          {versions
            .filter((version) => canEdit || version.status !== "borrador")
            .map((version) => (
              <li key={version.id}>
                <Link
                  href={`/sops/${version.id}`}
                  aria-current={version.id === sop.id ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-2 text-sm hover:border-primary",
                    version.id === sop.id ? "border-primary bg-card" : "border-border bg-card",
                  )}
                >
                  <span className="font-mono text-foreground">v{version.version}</span>
                  <span className="text-muted-foreground">
                    {SOP_STATUS_LABELS[version.status]}
                    {version.approvedAt ? ` · aprobada ${version.approvedAt.toLocaleDateString("es-CO")}` : ""}
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
