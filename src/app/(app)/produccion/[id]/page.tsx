import { notFound } from "next/navigation";
import Link from "next/link";
import { MODULE_ROLES, requirePageRole } from "@/lib/pageAccess";
import { withTenant } from "@/lib/db";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StageTracker } from "@/components/batch/StageTracker";
import { EventTimeline } from "@/components/batch/EventTimeline";
import { OfflineIndicator } from "@/components/layout/OfflineIndicator";
import { isSignableStage, STAGE_SIGNER_ROLES } from "@/lib/validation/production";
import { WEIGHABLE_STATUSES, getMissingIngredients } from "@/lib/production/weighing";
import { AttachmentList } from "@/components/attachments/AttachmentList";
import { AttachmentUploader } from "@/components/attachments/AttachmentUploader";
import { listAttachments } from "@/lib/attachments/service";
import { UPLOAD_ROLES } from "@/lib/validation/attachments";

export default async function BatchRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageRole(MODULE_ROLES.produccion);

  const order = await withTenant(user.tenantId, user.id, (tx) =>
    tx.productionOrder.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        formula: true,
        events: true,
        signatures: true,
        deviations: true,
      },
    }),
  );
  if (!order) {
    notFound();
  }

  // Final review wrap-up: `WEIGHABLE_STATUSES` (planificado | pesado) is the
  // same set `applyWeighing` accepts server-side — the link must stay
  // reachable for the whole window, not just `planificado`, otherwise a
  // multi-ingredient formula gets stuck after its first weighing (which
  // advances the order to `pesado`). While `pesado`, also surface how many
  // ingredients are still unweighed so it's clear the link is still needed.
  const missingIngredientsCount =
    order.status === "pesado"
      ? (await withTenant(user.tenantId, user.id, (tx) => getMissingIngredients(tx, user.tenantId, order))).length
      : 0;
  const evidence = await withTenant(user.tenantId, user.id, (tx) =>
    listAttachments(tx, user.tenantId, "production_order", order.id),
  );
  const canUploadEvidence = UPLOAD_ROLES.production_order.includes(user.role);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-mono text-2xl font-semibold text-foreground">{order.orderNumber}</h1>
          <span className="text-sm text-muted-foreground">
            {order.formula.name} (v{order.formulaVersion})
          </span>
        </div>
        <OfflineIndicator />
      </div>

      <StageTracker status={order.status} />

      {WEIGHABLE_STATUSES.includes(order.status) && (user.role === "operario" || user.role === "jefe_planta") && (
        <Button
          render={
            <Link href={`/produccion/${order.id}/pesaje`}>
              Registrar pesaje
              {order.status === "pesado" && missingIngredientsCount > 0
                ? ` (faltan ${missingIngredientsCount})`
                : ""}
            </Link>
          }
        />
      )}
      {/* Final review (Important 6): only shown to a role allowed to sign the
          CURRENT stage — `production.sign` enforces the same rule server-side. */}
      {isSignableStage(order.status) && STAGE_SIGNER_ROLES[order.status].includes(user.role) && (
        <Button render={<Link href={`/produccion/${order.id}/firma`}>Firmar</Link>} />
      )}
      {/* Task 12 review round 1: the only entry point into `qc.release`
          ("firma final" per Blueprint Section 8) — gated to director_tecnico
          at the `calidad` stage, matching the guard `liberar/page.tsx` itself
          re-checks server-side. */}
      {user.role === "director_tecnico" && order.status === "calidad" && (
        <Button render={<Link href={`/produccion/${order.id}/liberar`}>Liberar lote</Link>} />
      )}
      {/* Final review (Important 4): entry point into `qc.reject`, same gate. */}
      {user.role === "director_tecnico" && order.status === "calidad" && (
        <Button
          variant="destructive"
          render={<Link href={`/produccion/${order.id}/rechazar`}>Rechazar lote</Link>}
        />
      )}
      {/* Task 13 review round 1 (Critical finding fix): entry point into
          `deviations.create` — gated client-side to the same roles
          `deviations.create`'s `roleProcedure` allows server-side
          (`nueva/page.tsx` re-checks this, same pattern as `liberar/page.tsx`). */}
      {["calidad", "jefe_planta", "operario"].includes(user.role) && (
        <Button
          variant="outline"
          render={<Link href={`/produccion/${order.id}/desviacion/nueva`}>Reportar desviación</Link>}
        />
      )}

      {/* Batch record export: same roles /api/pdf/batch/[id] allows. */}
      {["calidad", "director_tecnico", "admin"].includes(user.role) && (
        <Button
          variant="outline"
          nativeButton={false}
          render={
            <a href={`/api/pdf/batch/${order.id}`} target="_blank" rel="noopener">
              <FileText aria-hidden />
              Descargar batch record (PDF)
            </a>
          }
        />
      )}

      <div className="flex flex-col gap-3">
        <h2 className="font-sans text-lg font-semibold text-foreground">Eventos del lote</h2>
        <EventTimeline events={order.events} />
      </div>

      <section aria-labelledby="evidence-title" className="flex flex-col gap-3">
        <h2 id="evidence-title" className="font-sans text-lg font-semibold text-foreground">
          Evidencias del lote
        </h2>
        <AttachmentList items={evidence} emptyText="Aún no hay evidencias adjuntas a esta orden." />
        {canUploadEvidence && (
          <AttachmentUploader
            entityType="production_order"
            entityId={order.id}
            label="Adjuntar evidencia (foto o documento)"
          />
        )}
      </section>
    </div>
  );
}
