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
// Lot selection: the brief's Step 7 calls for "a plain searchable <select>
// fed by materials.list" until the real `LotManualSearch` component lands in
// Task 15. This fetches `materials.listLots` (includes `rawMaterial`) via
// the tRPC React client and renders a native <select>, filtered to
// `status === "liberado"` lots — a QMS lot can't be weighed for production
// while still in quarantine or already rejected, matching the raw-material
// quarantine/release flow from Task 7.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { ToleranceIndicator } from "@/components/batch/ToleranceIndicator";
import { recordWeighingInput, type RecordWeighingValues } from "@/lib/validation/production";

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

  const lotsQuery = trpc.materials.listLots.useQuery();
  const recordWeighing = trpc.production.recordWeighing.useMutation();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formInput),
    defaultValues: { rawMaterialLotId: "", actualQty: 0 },
  });

  const lots = useMemo(
    () => (lotsQuery.data ?? []).filter((lot) => lot.status === "liberado"),
    [lotsQuery.data],
  );

  const selectedLotId = watch("rawMaterialLotId");
  const actualQty = watch("actualQty");

  const theoreticalQty = useMemo(() => {
    const selectedLot = lots.find((lot) => lot.id === selectedLotId);
    if (!selectedLot) return null;
    const ingredient = ingredients.find((item) => item.rawMaterialId === selectedLot.rawMaterialId);
    if (!ingredient) return null;
    return (ingredient.percentage / 100) * plannedQuantity;
  }, [lots, selectedLotId, ingredients, plannedQuantity]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    if (theoreticalQty === null) {
      setServerError("Seleccione un lote correspondiente a un ingrediente de la fórmula.");
      return;
    }
    try {
      await recordWeighing.mutateAsync({
        productionOrderId,
        rawMaterialLotId: values.rawMaterialLotId,
        theoreticalQty,
        actualQty: values.actualQty,
        clientEventId: crypto.randomUUID(),
        occurredAt: new Date().toISOString(),
      });
      router.push(`/produccion/${productionOrderId}`);
      router.refresh();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Error al registrar el pesaje");
    }
  });

  const isSaving = isSubmitting || recordWeighing.isPending;

  return (
    <form onSubmit={onSubmit} className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="rawMaterialLotId" className="text-sm font-medium text-foreground">
          Lote de materia prima
        </label>
        <select
          id="rawMaterialLotId"
          {...register("rawMaterialLotId")}
          disabled={lotsQuery.isLoading}
          className="h-11 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">Seleccionar...</option>
          {lots.map((lot) => (
            <option key={lot.id} value={lot.id}>
              {lot.rawMaterial.name} — {lot.supplierLotCode}
            </option>
          ))}
        </select>
        {errors.rawMaterialLotId && <p className="text-sm text-destructive">{errors.rawMaterialLotId.message}</p>}
        {!lotsQuery.isLoading && lots.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay lotes liberados disponibles.</p>
        )}
      </div>

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
