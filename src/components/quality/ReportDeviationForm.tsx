"use client";

// Client Component: form submission via tRPC mutation + live server-error
// state require real interactivity — same pattern as
// `NuevaOrdenForm.tsx` (Task 9).
//
// Task 13 review round 1 (Critical finding fix): before this component,
// `deviations.create` had no caller anywhere in the app — it type-checked
// and had test coverage, but no user could ever reach it from the running
// product, mirroring Task 12's `qc.release` defect exactly. This form is
// that missing entry point, reachable from `produccion/[id]/page.tsx` (the
// batch record screen a user is plausibly on when a deviation occurs).
//
// Bundle-safety (Task 7 lesson): imports only `createDeviationInput` from
// `@/lib/validation/deviations` (schema-only, zero dependency on
// `@/lib/trpc/trpc`/`@/lib/db`) — never the router file.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { createDeviationInput, type CreateDeviationValues } from "@/lib/validation/deviations";

const textareaClasses =
  "min-h-24 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ReportDeviationForm({ productionOrderId }: { productionOrderId: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const createDeviation = trpc.deviations.create.useMutation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateDeviationValues>({
    resolver: zodResolver(createDeviationInput),
    defaultValues: { productionOrderId, description: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const deviation = await createDeviation.mutateAsync(values);
      router.push(`/calidad/desviaciones/${deviation.id}`);
      router.refresh();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Error al reportar la desviación");
    }
  });

  const isSaving = isSubmitting || createDeviation.isPending;

  return (
    <form onSubmit={onSubmit} className="flex max-w-lg flex-col gap-4">
      <input type="hidden" {...register("productionOrderId")} value={productionOrderId} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium text-foreground">
          Descripción de la desviación
        </label>
        <textarea
          id="description"
          {...register("description")}
          className={textareaClasses}
          placeholder="Describa qué ocurrió, cuándo y en qué etapa del lote"
        />
        {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <Button type="submit" disabled={isSaving}>
        {isSaving ? "Reportando..." : "Reportar desviación"}
      </Button>
    </form>
  );
}
