"use client";

// Client Component: the plant manager edits a DRAFT formula's ingredients
// (change percentage, remove, add) with a live total against 100 % ± 0.5 %.
// The server re-checks the draft status and, at activation, the total.

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { isWithinTolerance } from "@/lib/formulas/validateComposition";
import { cn } from "@/lib/utils";

export type DraftIngredient = { id: string; materialLabel: string; percentage: number };
export type MaterialOption = { id: string; label: string };

const inputClass =
  "h-11 w-full min-w-0 rounded-lg border border-border bg-card px-3 font-mono text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function parsePercentage(value: string): number {
  return Number(value.trim().replace(",", "."));
}

function IngredientRow({ ingredient, onError }: { ingredient: DraftIngredient; onError: (message: string) => void }) {
  const router = useRouter();
  const [value, setValue] = useState(String(ingredient.percentage));
  const update = trpc.formulas.updateIngredient.useMutation({ onSuccess: () => router.refresh(), onError: (e) => onError(e.message) });
  const remove = trpc.formulas.removeIngredient.useMutation({ onSuccess: () => router.refresh(), onError: (e) => onError(e.message) });

  function save() {
    const percentage = parsePercentage(value);
    if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
      onError("El porcentaje debe ser mayor que 0 y máximo 100");
      return;
    }
    if (percentage !== ingredient.percentage) update.mutate({ id: ingredient.id, percentage });
  }

  return (
    <li className="flex items-center gap-2 py-2 text-sm">
      <span className="min-w-0 flex-1 text-foreground">{ingredient.materialLabel}</span>
      <input
        aria-label={`Porcentaje de ${ingredient.materialLabel}`}
        value={value}
        inputMode="decimal"
        onChange={(event) => setValue(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          }
        }}
        className={cn(inputClass, "w-24")}
      />
      <span className="text-muted-foreground">%</span>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Quitar ${ingredient.materialLabel}`}
        disabled={remove.isPending}
        onClick={() => remove.mutate({ id: ingredient.id })}
      >
        <Trash2 aria-hidden />
      </Button>
    </li>
  );
}

export function DraftIngredientsEditor({
  formulaId,
  ingredients,
  materials,
}: {
  formulaId: string;
  ingredients: DraftIngredient[];
  materials: MaterialOption[];
}) {
  const router = useRouter();
  const [materialId, setMaterialId] = useState("");
  const [percentage, setPercentage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const add = trpc.formulas.addIngredient.useMutation({
    onSuccess: () => {
      setMaterialId("");
      setPercentage("");
      setError(null);
      router.refresh();
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const total = ingredients.reduce((sum, ingredient) => sum + ingredient.percentage, 0);
  const used = new Set(ingredients.map((ingredient) => ingredient.materialLabel));
  const available = materials.filter((material) => !used.has(material.label));

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = parsePercentage(percentage);
    if (!materialId) return setError("Elija la materia prima");
    if (!Number.isFinite(value) || value <= 0 || value > 100) return setError("El porcentaje debe ser mayor que 0 y máximo 100");
    setError(null);
    add.mutate({ formulaId, rawMaterialId: materialId, percentage: value, orderIndex: ingredients.length });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Ingredientes (borrador editable)</h2>
        <span className={cn("font-mono text-sm font-medium", isWithinTolerance(total) ? "text-success" : "text-destructive")}>
          Total: {total.toFixed(2)}%
        </span>
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {ingredients.map((ingredient) => (
          <IngredientRow key={`${ingredient.id}-${ingredient.percentage}`} ingredient={ingredient} onError={setError} />
        ))}
        {ingredients.length === 0 && <li className="py-2 text-sm text-muted-foreground">Sin ingredientes registrados.</li>}
      </ul>
      <form onSubmit={onSubmit} className="grid grid-cols-[1fr_6rem_auto] items-end gap-2">
        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-foreground">
          Materia prima
          <select value={materialId} onChange={(event) => setMaterialId(event.target.value)} className={inputClass}>
            <option value="">Seleccionar...</option>
            {available.map((material) => (
              <option key={material.id} value={material.id}>
                {material.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-foreground">
          %
          <input value={percentage} inputMode="decimal" onChange={(event) => setPercentage(event.target.value)} className={inputClass} />
        </label>
        <Button type="submit" disabled={add.isPending}>
          {add.isPending ? "Agregando..." : "Agregar"}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
