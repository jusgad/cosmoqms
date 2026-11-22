import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MODULE_ROLES, requirePageRole } from "@/lib/pageAccess";
import { withTenant } from "@/lib/db";
import { LotStatusBadge } from "@/components/materials/LotStatusBadge";
import { LotStatusAction } from "@/components/materials/LotStatusAction";
import { AttachmentList } from "@/components/attachments/AttachmentList";
import { AttachmentUploader } from "@/components/attachments/AttachmentUploader";
import { listAttachments } from "@/lib/attachments/service";
import { UPLOAD_ROLES } from "@/lib/validation/attachments";

export default async function LotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageRole(MODULE_ROLES.materiasPrimas);

  const result = await withTenant(user.tenantId, user.id, async (tx) => {
    const found = await tx.rawMaterialLot.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { rawMaterial: true },
    });
    if (!found) return null;
    return { lot: found, attachments: await listAttachments(tx, user.tenantId, "raw_material_lot", found.id) };
  });

  if (!result) {
    notFound();
  }
  const { lot, attachments } = result;

  const canChangeStatus = user.role === "bodega" || user.role === "calidad";
  const canUpload = UPLOAD_ROLES.raw_material_lot.includes(user.role);
  // Same roles as /api/pdf/lot-label/[id].
  const canPrintLabel = (user.role === "bodega" || user.role === "calidad") && lot.qrCode !== null;

  const fields: { label: string; value: string }[] = [
    { label: "Materia prima", value: `${lot.rawMaterial.code} — ${lot.rawMaterial.name}` },
    { label: "Código de lote del proveedor", value: lot.supplierLotCode },
    { label: "Código interno del proveedor", value: lot.supplierProvidedCode ?? "No suministrado" },
    { label: "Código QR interno", value: lot.qrCode ?? "—" },
    { label: "Cantidad recibida", value: `${lot.quantityReceived} ${lot.rawMaterial.unit}` },
    { label: "Cantidad disponible", value: `${lot.quantityAvailable} ${lot.rawMaterial.unit}` },
    { label: "Fecha de recepción", value: lot.receivedAt.toLocaleDateString("es-CO", { timeZone: "America/Bogota" }) },
    { label: "Fecha de vencimiento", value: lot.expiryDate.toLocaleDateString("es-CO", { timeZone: "UTC" }) },
    { label: "Enlace externo del COA", value: lot.coaDocumentUrl ?? "No suministrado" },
  ];

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-sans text-2xl font-semibold text-foreground">Lote {lot.supplierLotCode}</h1>
        <LotStatusBadge status={lot.status} />
      </div>

      <dl className="grid grid-cols-1 gap-3 rounded-card border border-border bg-card p-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.label} className="flex flex-col gap-0.5">
            <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{field.label}</dt>
            <dd className="font-mono text-sm text-foreground">{field.value}</dd>
          </div>
        ))}
      </dl>

      {canChangeStatus && <LotStatusAction lotId={lot.id} status={lot.status} />}

      {canPrintLabel && (
        <Button
          variant="outline"
          nativeButton={false}
          render={
            <a href={`/api/pdf/lot-label/${lot.id}`} target="_blank" rel="noopener">
              <Printer aria-hidden />
              Imprimir etiqueta con QR
            </a>
          }
        />
      )}

      <section aria-labelledby="coa-title" className="flex flex-col gap-3">
        <h2 id="coa-title" className="font-sans text-lg font-semibold text-foreground">
          Certificados de análisis (COA)
        </h2>
        <AttachmentList items={attachments} emptyText="Este lote aún no tiene certificados adjuntos." />
        {canUpload && (
          <AttachmentUploader entityType="raw_material_lot" entityId={lot.id} label="Adjuntar certificado de análisis" />
        )}
      </section>
    </div>
  );
}
