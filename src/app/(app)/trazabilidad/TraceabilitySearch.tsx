"use client";

// Client Component: free-text search + a direction toggle is real
// interactivity, same reasoning as every other client component in this
// codebase (DeviationForm.tsx, QCResultForm.tsx, etc.).
//
// Bundle-safety (Task 7 lesson, reapplied here per the task-16 instructions):
// this file imports only `@/lib/trpc/client`'s React hooks. It never
// imports from `@/lib/trpc/router/traceability` (or any other router file),
// which would drag `PrismaClient`/`@/lib/db` into the browser bundle.
//
// Search-by-human-code design (see task-16-report.md): rather than making
// this component resolve a typed lot code to a UUID itself (which, for
// finished-product lots, would need a new listing endpoint that doesn't
// exist anywhere in the codebase yet), the code-to-id lookup happens
// server-side inside `traceabilityRouter` itself. This component only ever
// sends the human-readable code the user typed.
import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";

type Direction = "byRawMaterialLot" | "byFinishedLot";

export function TraceabilitySearch() {
  const [direction, setDirection] = useState<Direction>("byRawMaterialLot");
  const [code, setCode] = useState("");
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);

  const byRawMaterialLot = trpc.traceability.byRawMaterialLot.useQuery(
    { rawMaterialLotCode: submittedCode ?? "" },
    { enabled: direction === "byRawMaterialLot" && Boolean(submittedCode) },
  );
  const byFinishedLot = trpc.traceability.byFinishedLot.useQuery(
    { finishedProductLotCode: submittedCode ?? "" },
    { enabled: direction === "byFinishedLot" && Boolean(submittedCode) },
  );

  const activeQuery = direction === "byRawMaterialLot" ? byRawMaterialLot : byFinishedLot;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = code.trim();
    setSubmittedCode(trimmed.length > 0 ? trimmed : null);
  }

  function handleDirectionChange(next: Direction) {
    setDirection(next);
    setSubmittedCode(null);
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Dirección de búsqueda</span>
        {/* Direction toggle — touch targets ≥44px (CLAUDE.md rule 9). */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={direction === "byRawMaterialLot" ? "default" : "outline"}
            onClick={() => handleDirectionChange("byRawMaterialLot")}
          >
            Materia prima → Órdenes
          </Button>
          <Button
            type="button"
            variant={direction === "byFinishedLot" ? "default" : "outline"}
            onClick={() => handleDirectionChange("byFinishedLot")}
          >
            Producto terminado → Materias primas
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label htmlFor="lot-code" className="text-sm font-medium text-foreground">
          {direction === "byRawMaterialLot"
            ? "Código de lote de materia prima"
            : "Código de lote de producto terminado"}
        </label>
        <div className="flex gap-2">
          <input
            id="lot-code"
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder={direction === "byRawMaterialLot" ? "Ej. SUP-0001" : "Ej. PT-0001"}
            className="h-11 min-h-[44px] w-full rounded-lg border border-border bg-card px-3 font-mono text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Button type="submit" size="icon" aria-label="Buscar">
            <Search />
          </Button>
        </div>
      </form>

      {activeQuery.isFetching && <p className="text-sm text-muted-foreground">Buscando...</p>}

      {activeQuery.isError && (
        <p className="text-sm text-destructive">
          No se encontró un lote con ese código, o no tiene eventos de trazabilidad registrados.
        </p>
      )}

      {activeQuery.isSuccess && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">
            {direction === "byRawMaterialLot"
              ? "Órdenes de producción que consumieron este lote"
              : "Lotes de materia prima consumidos en este producto terminado"}
          </span>
          {activeQuery.data.length === 0 ? (
            <p className="rounded-card border border-border bg-card p-3 text-sm text-muted-foreground">
              Sin resultados de trazabilidad para este código.
            </p>
          ) : (
            <ul className="flex flex-col gap-1 pl-4">
              {activeQuery.data.map((entry) => (
                <li
                  key={entry}
                  className="min-h-[44px] rounded-lg border border-border bg-card px-3 py-2 font-mono text-sm text-foreground"
                >
                  {entry}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
