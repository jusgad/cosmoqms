"use client";

// Client Component: live tolerance feedback + a tRPC mutation on submit
// require real interactivity.
//
// Bundle-safety (Task 7/8/9 lesson): this file imports the input schema from
// `@/lib/validation/production` (schema-only, zero dependency on
// `@/lib/trpc/trpc`/`@/lib/db`) and never imports anything from
// `@/lib/trpc/router/production` or `@/lib/trpc/router/materials` (the
// router files), which would drag `PrismaClient` into the browser bundle.
//
// `theoreticalQty` approach: the order's `plannedQuantity` and the formula's
// ingredient percentages are fetched server-side (Prisma, no Prisma-typed
// value crossing into client code) in `produccion/[id]/pesaje/page.tsx` and
// passed down as plain-number/string props (`plannedQuantity`,
// `ingredients`). `theoreticalQty` is then derived client-side, reactively,
// as `ingredient.percentage / 100 * plannedQuantity` for whichever raw
// material the selected lot belongs to — so it updates live as the operator
// picks a different lot, with no extra round trip.
//
// Lot selection (Task 15): `materials.listLots` (includes `rawMaterial`) is
// filtered to `status === "liberado"` lots (Task 7's quarantine/release
// flow). `LotManualSearch` is the default, always-visible picker (zero
// camera dependency); `QRScanner` is an optional dialog shortcut that
// resolves a decoded code to one of these same lots via the identical
// `onSelect` path — submit never branches on which one was used.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ScanLineIcon } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ToleranceIndicator } from "@/components/batch/ToleranceIndicator";
import { LotManualSearch, type LotOption } from "@/components/batch/LotManualSearch";
import { QRScanner } from "@/components/batch/QRScanner";
import { recordWeighingInput, type RecordWeighingValues } from "@/lib/validation/production";
// Task 14 (queue-first submit): both are browser-only Dexie/localStorage
// modules with zero Prisma dependency, so importing them directly here keeps
// the same bundle-safety guarantee documented above — never a value-import
// from `@/lib/trpc/router/*`.
import { queueEvent, syncPendingEvents } from "@/lib/offline/sync-engine";
import { getDeviceId } from "@/lib/offline/device";

type FormulaIngredientProp = { rawMaterialId: string; percentage: number };

// The lot picker only needs `rawMaterialLotId`; `theoreticalQty` is derived
// and `clientEventId`/`occurredAt` are generated at submit time, so the form
// itself only manages the subset of `RecordWeighingValues` a person fills in.
type FormValues = Pick<RecordWeighingValues, "rawMaterialLotId" | "actualQty">;

const formInput = recordWeighingInput.pick({ rawMaterialLotId: true, actualQty: true });

export function WeighingForm({
  productionOrderId,
  plannedQuantity,
  ingredients,
}: {
  productionOrderId: string;
  plannedQuantity: number;
  ingredients: FormulaIngredientProp[];
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const lotsQuery = trpc.materials.listLots.useQuery();
  const [isSubmittingQueue, setIsSubmittingQueue] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formInput),
    defaultValues: { rawMaterialLotId: "", actualQty: 0 },
  });

  const lots = useMemo(
    () => (lotsQuery.data ?? []).filter((lot) => lot.status === "liberado"),
    [lotsQuery.data],
  );

  // Generic, Prisma-free shape `LotManualSearch` (and the scan-match lookup
  // below) work with — keeps that leaf component decoupled from the
  // tRPC-inferred `RawMaterialLot & { rawMaterial }` type.
  const lotOptions = useMemo<LotOption[]>(
    () =>
      lots.map((lot) => ({
        id: lot.id,
        rawMaterialName: lot.rawMaterial.name,
        supplierLotCode: lot.supplierLotCode,
      })),
    [lots],
  );

  const selectedLotId = watch("rawMaterialLotId");
  const actualQty = watch("actualQty");
  const selectedLot = lots.find((lot) => lot.id === selectedLotId) ?? null;

  function selectLot(lot: LotOption) {
    setScanError(null);
    setValue("rawMaterialLotId", lot.id, { shouldValidate: true });
  }

  // `onDecode` hands back the raw decoded string (the lot's `qrCode` or a
  // `supplierProvidedCode`). Resolve it against the same liberado-filtered
  // `lots` and drive it through `selectLot`. An unmatched scan must not be a
  // silent no-op — surface it so the operator falls back to
  // `LotManualSearch`, never hidden behind this dialog.
  function handleDecode(code: string) {
    const match = lots.find((lot) => lot.qrCode === code || lot.supplierProvidedCode === code);
    if (!match) {
      setScanError(`No se encontró un lote liberado con el código "${code}".`);
      return;
    }
    selectLot({
      id: match.id,
      rawMaterialName: match.rawMaterial.name,
      supplierLotCode: match.supplierLotCode,
    });
    setScannerOpen(false);
  }

  const theoreticalQty = useMemo(() => {
    const selectedLot = lots.find((lot) => lot.id === selectedLotId);
    if (!selectedLot) return null;
    const ingredient = ingredients.find((item) => item.rawMaterialId === selectedLot.rawMaterialId);
    if (!ingredient) return null;
    return (ingredient.percentage / 100) * plannedQuantity;
  }, [lots, selectedLotId, ingredients, plannedQuantity]);

  // Queue-first submit (Task 14): the write always succeeds locally — it is
  // appended to the Dexie `pendingEvents` queue — even if the immediate sync
  // attempt below fails or the device is offline. `OfflineIndicator`'s live
  // queue-depth count and its own `online` listener (which also calls
  // `syncPendingEvents()`) are what eventually get this event to the server;
  // this optimistic call is just a same-tick "try now if we can" attempt,
  // never the only chance the event gets to sync. This is why `WeighingForm`
  // never calls `production.recordWeighing`/`fetch` directly any more — see
  // the architecture-gap resolution in `app/api/sync/events/route.ts` for why
  // the sync route (not this form) is now responsible for calling
  // `advanceStageInternal` once the event actually reaches the server.
  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    if (theoreticalQty === null) {
      setServerError("Seleccione un lote correspondiente a un ingrediente de la fórmula.");
      return;
    }
    setIsSubmittingQueue(true);
    try {
      await queueEvent({
        clientEventId: crypto.randomUUID(),
        productionOrderId,
        eventType: "weighing",
        payload: {
          rawMaterialLotId: values.rawMaterialLotId,
          theoreticalQty,
          actualQty: values.actualQty,
        },
        occurredAt: new Date().toISOString(),
        deviceId: getDeviceId(),
      });

      if (navigator.onLine) {
        // Best-effort: a failure here (network flake, server down) is not
        // surfaced as a form error — the event is already safely queued and
        // will be retried by `OfflineIndicator`'s `online` listener.
        await syncPendingEvents().catch(() => undefined);
      }

      router.push(`/produccion/${productionOrderId}`);
      router.refresh();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Error al registrar el pesaje");
    } finally {
      setIsSubmittingQueue(false);
    }
  });

  const isSaving = isSubmitting || isSubmittingQueue;

  return (
    <form onSubmit={onSubmit} className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="rawMaterialLotId" className="text-sm font-medium text-foreground">
            Lote de materia prima
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setScanError(null);
              setScannerOpen(true);
            }}
          >
            <ScanLineIcon data-icon="inline-start" />
            Escanear
          </Button>
        </div>

        {/* Register a hidden field so react-hook-form/zod validates
            `rawMaterialLotId` on submit even though it's now set via
            `setValue` (from `LotManualSearch`/`QRScanner`), not by a native
            input the user types into directly. */}
        <input type="hidden" id="rawMaterialLotId" {...register("rawMaterialLotId")} />

        {selectedLot ? (
          <div className="flex min-h-[44px] items-center justify-between rounded-lg border border-border bg-muted px-3">
            <span className="font-mono text-sm text-foreground">
              {selectedLot.rawMaterial.name} — {selectedLot.supplierLotCode}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setValue("rawMaterialLotId", "")}>
              Cambiar
            </Button>
          </div>
        ) : (
          // Non-negotiable (Blueprint, since Task 7): manual entry always
          // works standalone — this is the default, always-visible picker,
          // never blocked on or dependent on the scanner above.
          <LotManualSearch lots={lotOptions} onSelect={selectLot} />
        )}

        {errors.rawMaterialLotId && <p className="text-sm text-destructive">{errors.rawMaterialLotId.message}</p>}
        {scanError && <p className="text-sm text-destructive">{scanError}</p>}
        {/* Task-10 review round 1 fix: a FORBIDDEN/network failure must be
            visible, not look identical to "no lots in inventory" — otherwise
            a future permission regression (like the operario-role gap this
            same review found) silently hides itself behind an empty-state
            message. */}
        {lotsQuery.isError && (
          <p className="text-sm text-destructive">Error al cargar los lotes disponibles.</p>
        )}
        {!lotsQuery.isLoading && !lotsQuery.isError && lots.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay lotes liberados disponibles.</p>
        )}
      </div>

      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escanear código del lote</DialogTitle>
            <DialogDescription>
              Apunte la cámara al código QR o de barras del lote. Puede cerrar esto en cualquier
              momento y buscar el lote manualmente.
            </DialogDescription>
          </DialogHeader>
          {scannerOpen && <QRScanner onDecode={handleDecode} onClose={() => setScannerOpen(false)} />}
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Cantidad teórica</span>
        <span className="font-mono text-sm text-foreground">
          {theoreticalQty === null ? "—" : theoreticalQty.toFixed(3)}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="actualQty" className="text-sm font-medium text-foreground">
          Cantidad pesada
        </label>
        <input
          id="actualQty"
          type="number"
          step="any"
          {...register("actualQty", { valueAsNumber: true })}
          className="h-11 rounded-lg border border-border bg-card px-3 font-mono text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {errors.actualQty && <p className="text-sm text-destructive">{errors.actualQty.message}</p>}
      </div>

      {theoreticalQty !== null && actualQty > 0 && (
        <ToleranceIndicator theoretical={theoreticalQty} actual={actualQty} />
      )}

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <Button type="submit" disabled={isSaving || lots.length === 0}>
        {isSaving ? "Registrando..." : "Registrar pesaje"}
      </Button>
    </form>
  );
}
