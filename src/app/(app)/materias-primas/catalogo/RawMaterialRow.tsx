"use client";

// Client Component: one catalog row that bodega can edit in place or delete.
// The server refuses to delete a material that was ever received or used in
// a formula (it is part of the batch-record history) and its message is shown.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { rawMaterialInput } from "@/lib/validation/materials";
import { Button } from "@/components/ui/button";
import { catalogInputClass } from "@/app/(app)/materias-primas/catalogo/RawMaterialForm";

export type CatalogRow = {
  id: string;
  code: string;
  name: string;
  unit: string;
  category: string | null;
  lots: number;
  formulas: number;
};

export function RawMaterialRow({ row, canEdit }: { row: CatalogRow; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(row.name);
  const [unit, setUnit] = useState(row.unit);
  const [category, setCategory] = useState(row.category ?? "");
  const [error, setError] = useState<string | null>(null);

  const update = trpc.materials.update.useMutation({
    onSuccess: () => {
      setEditing(false);
      setError(null);
      router.refresh();
    },
    onError: (mutationError) => setError(mutationError.message),
  });
  const remove = trpc.materials.delete.useMutation({
    onSuccess: () => router.refresh(),
    onError: (mutationError) => setError(mutationError.message),
  });

  function save() {
    const parsed = rawMaterialInput
      .omit({ code: true })
      .safeParse({ name, unit, category: category.trim() || undefined });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revise los datos");
      return;
    }
    update.mutate({ id: row.id, data: parsed.data });
  }

  const usage = `${row.lots} lote(s) · ${row.formulas} fórmula(s)`;

  return (
    <>
      <tr className="border-b border-border last:border-b-0">
        <td className="px-4 py-2 font-mono text-foreground">{row.code}</td>
        <td className="px-4 py-2 text-foreground">
          {editing ? (
            <input aria-label="Nombre" value={name} onChange={(event) => setName(event.target.value)} className={`${catalogInputClass} w-full`} />
          ) : (
            row.name
          )}
        </td>
        <td className="px-4 py-2 font-mono text-muted-foreground">
          {editing ? (
            <input aria-label="Unidad" value={unit} onChange={(event) => setUnit(event.target.value)} className={`${catalogInputClass} !w-20`} />
          ) : (
            row.unit
          )}
        </td>
        <td className="px-4 py-2 text-muted-foreground">
          {editing ? (
            <input aria-label="Categoría" value={category} onChange={(event) => setCategory(event.target.value)} className={`${catalogInputClass} w-full`} />
          ) : (
            row.category ?? "—"
          )}
        </td>
        <td className="px-4 py-2 text-xs text-muted-foreground">{usage}</td>
        {canEdit && (
          <td className="px-4 py-2">
            <div className="flex justify-end gap-1">
              {editing ? (
                <>
                  <Button onClick={save} disabled={update.isPending}>
                    {update.isPending ? "Guardando..." : "Guardar"}
                  </Button>
                  <Button variant="outline" onClick={() => setEditing(false)}>
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="icon" aria-label={`Editar ${row.code}`} onClick={() => setEditing(true)}>
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Eliminar ${row.code}`}
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(`¿Eliminar ${row.code} — ${row.name} del catálogo?`)) remove.mutate({ id: row.id });
                    }}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </>
              )}
            </div>
          </td>
        )}
      </tr>
      {error && (
        <tr>
          <td colSpan={canEdit ? 6 : 5} className="px-4 pb-2 text-sm text-destructive">
            {error}
          </td>
        </tr>
      )}
    </>
  );
}
