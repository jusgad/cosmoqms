"use client";

// Client Component: bodega adds a material to the catalog and needs the
// server's messages (e.g. a duplicate code) shown inline.

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { trpc } from "@/lib/trpc/client";
import { rawMaterialInput } from "@/lib/validation/materials";
import { Button } from "@/components/ui/button";

export const catalogInputClass =
  "h-11 w-full min-w-0 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function RawMaterialForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("kg");
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const create = trpc.materials.create.useMutation({
    onSuccess: (material) => {
      setSaved(`${material.code} — ${material.name} quedó en el catálogo.`);
      setCode("");
      setName("");
      setCategory("");
      setError(null);
      router.refresh();
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(null);
    const parsed = rawMaterialInput.safeParse({ code, name, unit, category: category.trim() || undefined });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revise los datos de la materia prima");
      return;
    }
    setError(null);
    create.mutate(parsed.data);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">Nueva materia prima</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_2fr_1fr_1.5fr_auto] sm:items-end">
        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-foreground">
          Código
          <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="MP-006" className={`${catalogInputClass} font-mono`} />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-foreground">
          Nombre
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Manteca de karité" className={catalogInputClass} />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-foreground">
          Unidad
          <select value={unit} onChange={(event) => setUnit(event.target.value)} className={catalogInputClass}>
            <option value="kg">kg</option>
            <option value="g">g</option>
            <option value="L">L</option>
            <option value="mL">mL</option>
            <option value="und">und</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-foreground">
          Categoría (opcional)
          <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="emoliente" className={catalogInputClass} />
        </label>
        <Button type="submit" className="col-span-2 sm:col-span-1" disabled={create.isPending}>
          {create.isPending ? "Guardando..." : "Agregar"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-success">{saved}</p>}
    </form>
  );
}
