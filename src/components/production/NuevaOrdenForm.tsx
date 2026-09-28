"use client";

// Client Component: form submission via tRPC mutation + live server-error
// state require real interactivity.
//
// Bundle-safety (Task 7/8 lesson): this file imports the input schema from
// `@/lib/validation/production` — a schema-only module with zero dependency
// on `@/lib/trpc/trpc` or `@/lib/db` — and never imports anything from
// `@/lib/trpc/router/production` (the router file), which would drag
// `PrismaClient` into the browser bundle. Formula options come from the
// `formulas.listActive` tRPC query (client-side), not a server-passed prop,
// per the brief's Step 9 interface ("form selecting only formulas.listActive
// results").
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { createProductionOrderInput, type CreateProductionOrderValues } from "@/lib/validation/production";

export function NuevaOrdenForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const formulasQuery = trpc.formulas.listActive.useQuery();
  const createOrder = trpc.production.create.useMutation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateProductionOrderValues>({
    resolver: zodResolver(createProductionOrderInput),
    defaultValues: { formulaId: "", plannedQuantity: 0, plannedStart: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const order = await createOrder.mutateAsync({
        formulaId: values.formulaId,
        plannedQuantity: values.plannedQuantity,
        plannedStart: values.plannedStart || undefined,
      });
      router.push(`/produccion?created=${order.orderNumber}`);
      router.refresh();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Error al crear la orden");
    }
  });

  const isSaving = isSubmitting || createOrder.isPending;
  const formulas = formulasQuery.data ?? [];

  return (
    <form onSubmit={onSubmit} className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="formulaId" className="text-sm font-medium text-foreground">
          Fórmula (solo activas)
        </label>
        <select
          id="formulaId"
          {...register("formulaId")}
          disabled={formulasQuery.isLoading}
          className="h-11 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">Seleccionar...</option>
          {formulas.map((formula) => (
            <option key={formula.id} value={formula.id}>
              {formula.code} — {formula.name} (v{formula.version})
            </option>
          ))}
        </select>
        {errors.formulaId && <p className="text-sm text-destructive">{errors.formulaId.message}</p>}
        {!formulasQuery.isLoading && formulas.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay fórmulas activas disponibles.</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="plannedQuantity" className="text-sm font-medium text-foreground">
          Cantidad planificada
        </label>
        <input
          id="plannedQuantity"
          type="number"
          step="any"
          {...register("plannedQuantity", { valueAsNumber: true })}
          className="h-11 rounded-lg border border-border bg-card px-3 font-mono text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {errors.plannedQuantity && <p className="text-sm text-destructive">{errors.plannedQuantity.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="plannedStart" className="text-sm font-medium text-foreground">
          Inicio planificado (opcional)
        </label>
        <input
          id="plannedStart"
          type="date"
          {...register("plannedStart")}
          className="h-11 rounded-lg border border-border bg-card px-3 font-mono text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <Button type="submit" disabled={isSaving || formulas.length === 0}>
        {isSaving ? "Creando..." : "Crear orden"}
      </Button>
    </form>
  );
}
