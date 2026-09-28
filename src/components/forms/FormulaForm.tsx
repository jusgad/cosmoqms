"use client";

// Client Component: dynamic ingredient rows (add/remove) and a live running
// total require real interactivity (useFieldArray + mutation state).
//
// Bundle-safety: this file imports validation schemas from
// `@/lib/validation/formulas` and pure math from
// `@/lib/formulas/validateComposition` only — both are schema/logic-only
// modules with zero dependency on `@/lib/trpc/trpc` or `@/lib/db`. It never
// imports anything from `@/lib/trpc/router/formulas` (the router file),
// which would drag `PrismaClient` into the browser bundle — see Task 7's
// incident report (ReceiveLotForm.tsx) for why this matters.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { createFormulaInput, formulaIngredientInput } from "@/lib/validation/formulas";
import { sumPercentages, isWithinTolerance } from "@/lib/formulas/validateComposition";
import { cn } from "@/lib/utils";

const formulaFormSchema = createFormulaInput.extend({
  ingredients: z.array(formulaIngredientInput).min(1, "Agrega al menos un ingrediente"),
});

type FormulaFormValues = z.infer<typeof formulaFormSchema>;

export type RawMaterialOption = { id: string; code: string; name: string };

export function FormulaForm({ materials }: { materials: RawMaterialOption[] }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormulaFormValues>({
    resolver: zodResolver(formulaFormSchema),
    defaultValues: { code: "", name: "", productType: "", ingredients: [{ rawMaterialId: "", percentage: 0 }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "ingredients" });
  const ingredients = watch("ingredients");
  const total = sumPercentages(
    (ingredients ?? []).map((ingredient) => ({ percentage: Number(ingredient?.percentage) || 0 })),
  );
  const withinTolerance = isWithinTolerance(total);

  const createFormula = trpc.formulas.create.useMutation();
  const addIngredient = trpc.formulas.addIngredient.useMutation();

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const formula = await createFormula.mutateAsync({
        code: values.code,
        name: values.name,
        productType: values.productType || undefined,
      });
      for (const [index, ingredient] of values.ingredients.entries()) {
        await addIngredient.mutateAsync({
          formulaId: formula.id,
          rawMaterialId: ingredient.rawMaterialId,
          percentage: ingredient.percentage,
          orderIndex: index,
        });
      }
      router.push(`/formulas/${formula.id}`);
      router.refresh();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Error al guardar la fórmula");
    }
  });

  const isSaving = isSubmitting || createFormula.isPending || addIngredient.isPending;

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="code" className="text-sm font-medium text-foreground">
          Código
        </label>
        <input
          id="code"
          {...register("code")}
          className="h-11 rounded-lg border border-border bg-card px-3 font-mono text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium text-foreground">
          Nombre
        </label>
        <input
          id="name"
          {...register("name")}
          className="h-11 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="productType" className="text-sm font-medium text-foreground">
          Tipo de producto (opcional)
        </label>
        <input
          id="productType"
          {...register("productType")}
          className="h-11 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Ingredientes</h2>
          <span
            className={cn(
              "font-mono text-sm font-medium",
              withinTolerance ? "text-success" : "text-destructive",
            )}
          >
            Total: {total.toFixed(2)}%
          </span>
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="flex flex-wrap items-start gap-2 rounded-card border border-border bg-card p-3">
            <div className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
              <label htmlFor={`ingredients.${index}.rawMaterialId`} className="text-xs font-medium text-foreground">
                Materia prima
              </label>
              <select
                id={`ingredients.${index}.rawMaterialId`}
                {...register(`ingredients.${index}.rawMaterialId` as const)}
                className="h-11 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Seleccionar...</option>
                {materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.code} — {material.name}
                  </option>
                ))}
              </select>
              {errors.ingredients?.[index]?.rawMaterialId && (
                <p className="text-sm text-destructive">{errors.ingredients[index]?.rawMaterialId?.message}</p>
              )}
            </div>

            <div className="flex w-32 flex-col gap-1.5">
              <label htmlFor={`ingredients.${index}.percentage`} className="text-xs font-medium text-foreground">
                Porcentaje
              </label>
              <input
                id={`ingredients.${index}.percentage`}
                type="number"
                step="any"
                {...register(`ingredients.${index}.percentage` as const, { valueAsNumber: true })}
                className="h-11 rounded-lg border border-border bg-card px-3 font-mono text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              {errors.ingredients?.[index]?.percentage && (
                <p className="text-sm text-destructive">{errors.ingredients[index]?.percentage?.message}</p>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="mt-6"
              onClick={() => remove(index)}
              disabled={fields.length <= 1}
              aria-label="Quitar ingrediente"
            >
              <Trash2 className="size-5" aria-hidden />
            </Button>
          </div>
        ))}

        {errors.ingredients?.message && <p className="text-sm text-destructive">{errors.ingredients.message}</p>}

        <Button
          type="button"
          variant="outline"
          onClick={() => append({ rawMaterialId: "", percentage: 0 })}
        >
          <Plus className="size-4" aria-hidden />
          Agregar ingrediente
        </Button>
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <Button type="submit" disabled={isSaving}>
        {isSaving ? "Guardando..." : "Guardar fórmula"}
      </Button>
    </form>
  );
}
