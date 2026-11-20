import { CircleAlertIcon, ScanLineIcon } from "lucide-react";
import type { SupplierQrData } from "@/lib/materials/supplierQr";

const FORMAT_LABEL: Record<SupplierQrData["format"], string> = {
  gs1: "GS1",
  json: "JSON",
  "clave-valor": "texto con campos",
  texto: "código simple",
};

// Shows what a supplier QR filled in, so the operator checks it before
// receiving. Purely informative: every field stays editable in the form.
export function QrReadSummary({
  data,
  materialLabel,
}: {
  data: SupplierQrData;
  materialLabel: string | null;
}) {
  const rows: Array<[string, string]> = [];
  if (materialLabel) rows.push(["Materia prima", materialLabel]);
  if (data.supplierLotCode) rows.push(["Lote del proveedor", data.supplierLotCode]);
  if (data.quantity !== undefined) rows.push(["Cantidad", String(data.quantity)]);
  if (data.expiryDate) rows.push(["Vencimiento", data.expiryDate]);
  if (data.coaUrl) rows.push(["COA", data.coaUrl]);
  if (data.supplierCode) rows.push(["Código del proveedor", data.supplierCode]);

  const unmatched = !materialLabel && (data.materialCode || data.materialName);

  return (
    <section aria-live="polite" className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <ScanLineIcon className="size-4 text-primary" aria-hidden />
        QR leído ({FORMAT_LABEL[data.format]}): {rows.length} {rows.length === 1 ? "dato" : "datos"} llenados
      </p>
      {rows.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="break-all font-mono text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {unmatched && (
        <p className="flex items-start gap-2 text-sm text-pending">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          El QR indica la materia prima &ldquo;{data.materialCode ?? data.materialName}&rdquo;, pero no
          está en el catálogo con ese código o nombre. Selecciónela a mano.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Revise cada campo antes de recibir. El lote entra en cuarentena hasta que bodega o calidad lo
        libere.
      </p>
    </section>
  );
}
