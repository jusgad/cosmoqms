"use client";

// Client Component: quality adds and removes a draft formula's acceptance
// criteria (pH, viscosity…) and must see the server's validation messages
// inline. The server re-checks everything (role, draft status, duplicates).

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { qcSpecificationInput } from "@/lib/validation/formulas";
import { Button } from "@/components/ui/button";
import { formatRange } from "@/lib/quality/formatSpec";

export type SpecRow = { id: string; parameter: string; minValue: number | null; maxValue: number | null; unit: string | null };

const inputClass =
  "h-11 w-full min-w-0 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function toNumber(value: string): number | undefined {
  const trimmed = value.trim().replace(",", ".");
  if (trimmed === "") return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function QcSpecificationEditor({ formulaId, specs }: { formulaId: string; specs: SpecRow[] }) {
  const router = useRouter();
  const [parameter, setParameter] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [unit, setUnit] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = trpc.formulas.addSpecification.useMutation({
    onSuccess: () => {
      setParameter("");
      setMin("");
      setMax("");
      setUnit("");
      setError(null);
      router.refresh();
    },
    onError: (mutationError) => setError(mutationError.message),
  });
  const remove = trpc.formulas.removeSpecification.useMutation({
    onSuccess: () => router.refresh(),
    onError: (mutationError) => setError(mutationError.message),
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = qcSpecificationInput.safeParse({
      formulaId,
      parameter,
      minValue: toNumber(min),
      maxValue: toNumber(max),
      unit: unit.trim() || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revise los datos de la especificación");
      return;
    }
    setError(null);
    add.mutate(parsed.data);
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-border">
        {specs.map((spec) => (
          <li key={spec.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <span className="text-foreground">{spec.parameter}</span>
            <span className="flex items-center gap-2">
              <span className="font-mono text-muted-foreground">{formatRange(spec)}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Quitar especificación ${spec.parameter}`}
                disabled={remove.isPending}
                onClick={() => remove.mutate({ id: spec.id })}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </span>
          </li>
        ))}
        {specs.length === 0 && <li className="py-2 text-sm text-muted-foreground">Sin especificaciones registradas.</li>}
      </ul>

      <form onSubmit={onSubmit} className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
        <label className="col-span-2 flex min-w-0 flex-col gap-1.5 text-xs font-medium text-foreground sm:col-span-1">
          Parámetro
          <input value={parameter} onChange={(event) => setParameter(event.target.value)} placeholder="pH" className={inputClass} />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-foreground">
          Mínimo
          <input value={min} onChange={(event) => setMin(event.target.value)} inputMode="decimal" className={`${inputClass} font-mono`} />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-foreground">
          Máximo
          <input value={max} onChange={(event) => setMax(event.target.value)} inputMode="decimal" className={`${inputClass} font-mono`} />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-foreground">
          Unidad
          <input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="cP" className={inputClass} />
        </label>
        <Button type="submit" className="col-span-2 sm:col-span-1" disabled={add.isPending}>
          {add.isPending ? "Agregando..." : "Agregar"}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
