import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { LotStatusBadge } from "@/components/materials/LotStatusBadge";
import { LotStatusAction } from "@/components/materials/LotStatusAction";

export default async function LotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const lot = await withTenant(user.tenantId, (tx) =>
    tx.rawMaterialLot.findUnique({ where: { id }, include: { rawMaterial: true } }),
  );

  if (!lot) {
    notFound();
  }

  const canChangeStatus = user.role === "bodega" || user.role === "calidad";

  const fields: { label: string; value: string }[] = [
    { label: "Materia prima", value: `${lot.rawMaterial.code} — ${lot.rawMaterial.name}` },
    { label: "Código de lote del proveedor", value: lot.supplierLotCode },
    { label: "Código interno del proveedor", value: lot.supplierProvidedCode ?? "No suministrado" },
    { label: "Código QR interno", value: lot.qrCode ?? "—" },
    { label: "Cantidad recibida", value: `${lot.quantityReceived} ${lot.rawMaterial.unit}` },
    { label: "Cantidad disponible", value: `${lot.quantityAvailable} ${lot.rawMaterial.unit}` },
    { label: "Fecha de recepción", value: lot.receivedAt.toLocaleDateString("es-CO") },
    { label: "Fecha de vencimiento", value: lot.expiryDate.toLocaleDateString("es-CO") },
    { label: "Certificado de análisis (COA)", value: lot.coaDocumentUrl ?? "No suministrado" },
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
    </div>
  );
}
