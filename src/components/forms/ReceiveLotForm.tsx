"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ScanLineIcon } from "lucide-react";
import { z } from "zod";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { receiveLotInput } from "@/lib/validation/materials";
import { matchMaterial, parseSupplierQr, type SupplierQrData } from "@/lib/materials/supplierQr";
import { SupplierQrDialog } from "./SupplierQrDialog";
import { QrReadSummary } from "./QrReadSummary";

type ReceiveLotFormValues = z.infer<typeof receiveLotInput>;

export type RawMaterialOption = { id: string; code: string; name: string };

export function ReceiveLotForm({ materials }: { materials: RawMaterialOption[] }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [qrRead, setQrRead] = useState<{ data: SupplierQrData; materialLabel: string | null } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ReceiveLotFormValues>({
    resolver: zodResolver(receiveLotInput),
  });

  // A scan is a pre-fill convenience only: many suppliers encode material,
  // lot, quantity and expiry in their QR (GS1, JSON or "LOTE: …" text), so
  // whatever `parseSupplierQr` recognizes fills the matching field. Nothing
  // is submitted automatically — the operator reviews every field, and the
  // server still puts the lot in `cuarentena` regardless of what was scanned.
  function handleDecode(code: string) {
    const data = parseSupplierQr(code);
    const material = matchMaterial(data, materials);
    const opts = { shouldValidate: true, shouldDirty: true } as const;
    if (material) setValue("rawMaterialId", material.id, opts);
    if (data.supplierLotCode) setValue("supplierLotCode", data.supplierLotCode, opts);
    if (data.quantity !== undefined) setValue("quantityReceived", data.quantity, opts);
    if (data.expiryDate) setValue("expiryDate", data.expiryDate, opts);
    if (data.coaUrl) setValue("coaDocumentUrl", data.coaUrl, opts);
    if (data.supplierCode) setValue("supplierProvidedCode", data.supplierCode, opts);
    setQrRead({ data, materialLabel: material ? `${material.code} — ${material.name}` : null });
    setScannerOpen(false);
  }

  const receiveLot = trpc.materials.receiveLot.useMutation({
    onSuccess: (lot) => {
      router.push(`/materias-primas/${lot.id}`);
      router.refresh();
    },
    onError: (error) => setServerError(error.message),
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    receiveLot.mutate(values);
  });

  return (
    <form onSubmit={onSubmit} className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-4">
        <p className="text-sm text-foreground">
          ¿El empaque trae QR del proveedor? Léalo y CosmoQMS llena los datos que traiga.
        </p>
        <Button type="button" variant="outline" onClick={() => setScannerOpen(true)}>
          <ScanLineIcon data-icon="inline-start" />
          Leer QR del proveedor
        </Button>
      </div>

      {qrRead && <QrReadSummary data={qrRead.data} materialLabel={qrRead.materialLabel} />}

      <SupplierQrDialog open={scannerOpen} onOpenChange={setScannerOpen} onDecode={handleDecode} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="rawMaterialId" className="text-sm font-medium text-foreground">
          Materia prima
        </label>
        <select
          id="rawMaterialId"
          {...register("rawMaterialId")}
          className="h-11 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">Seleccionar...</option>
          {materials.map((material) => (
            <option key={material.id} value={material.id}>
              {material.code} — {material.name}
            </option>
          ))}
        </select>
        {errors.rawMaterialId && (
          <p className="text-sm text-destructive">{errors.rawMaterialId.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="supplierLotCode" className="text-sm font-medium text-foreground">
          Código de lote del proveedor
        </label>
        <input
          id="supplierLotCode"
          {...register("supplierLotCode")}
          className="h-11 rounded-lg border border-border bg-card px-3 font-mono text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {errors.supplierLotCode && (
          <p className="text-sm text-destructive">{errors.supplierLotCode.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="supplierProvidedCode" className="text-sm font-medium text-foreground">
          Código del proveedor (opcional)
        </label>
        <input
          id="supplierProvidedCode"
          {...register("supplierProvidedCode", {
            setValueAs: (value: string) => (value === "" ? undefined : value),
          })}
          className="h-11 rounded-lg border border-border bg-card px-3 font-mono text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <p className="text-sm text-muted-foreground">
          Lo llena el QR del proveedor (por ejemplo, el GTIN). Si el proveedor no entrega uno,
          CosmoQMS genera un código interno al recibir el lote; este campo nunca bloquea la recepción
          manual.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="quantityReceived" className="text-sm font-medium text-foreground">
          Cantidad recibida
        </label>
        <input
          id="quantityReceived"
          type="number"
          step="any"
          {...register("quantityReceived", { valueAsNumber: true })}
          className="h-11 rounded-lg border border-border bg-card px-3 font-mono text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {errors.quantityReceived && (
          <p className="text-sm text-destructive">{errors.quantityReceived.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="expiryDate" className="text-sm font-medium text-foreground">
          Fecha de vencimiento
        </label>
        <input
          id="expiryDate"
          type="date"
          {...register("expiryDate")}
          className="h-11 rounded-lg border border-border bg-card px-3 font-mono text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {errors.expiryDate && <p className="text-sm text-destructive">{errors.expiryDate.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="coaDocumentUrl" className="text-sm font-medium text-foreground">
          URL del certificado de análisis (COA, opcional)
        </label>
        <input
          id="coaDocumentUrl"
          type="url"
          {...register("coaDocumentUrl", {
            setValueAs: (value: string) => (value === "" ? undefined : value),
          })}
          className="h-11 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {errors.coaDocumentUrl && (
          <p className="text-sm text-destructive">{errors.coaDocumentUrl.message}</p>
        )}
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <Button type="submit" disabled={isSubmitting || receiveLot.isPending}>
        {receiveLot.isPending ? "Registrando..." : "Recibir lote"}
      </Button>
    </form>
  );
}
