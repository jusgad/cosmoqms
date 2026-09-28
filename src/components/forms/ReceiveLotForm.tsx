"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { QrCode } from "lucide-react";
import { z } from "zod";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { receiveLotInput } from "@/lib/validation/materials";

type ReceiveLotFormValues = z.infer<typeof receiveLotInput>;

export type RawMaterialOption = { id: string; code: string; name: string };

export function ReceiveLotForm({ materials }: { materials: RawMaterialOption[] }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ReceiveLotFormValues>({
    resolver: zodResolver(receiveLotInput),
  });

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
        <div className="flex gap-2">
          <input
            id="supplierLotCode"
            {...register("supplierLotCode")}
            className="h-11 flex-1 rounded-lg border border-border bg-card px-3 font-mono text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled
            aria-label="Escanear código (disponible próximamente)"
            title="Escanear con cámara — se habilita en la Tarea 15 (QRScanner). La captura manual funciona hoy sin depender del escáner."
          >
            <QrCode className="size-5" aria-hidden />
          </Button>
        </div>
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
          Si el proveedor no entrega un código propio, CosmoQMS genera uno interno automáticamente al recibir el
          lote.
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
