"use client";

// Client Component: capturing a measurement and submitting a tRPC mutation
// requires real interactivity (useState + useMutation).
//
// Bundle-safety (Task 7 lesson, applied again here per this task's brief):
// this file imports the input schema from `@/lib/validation/qc`
// (schema-only, zero dependency on `@/lib/trpc/trpc`/`@/lib/db`) and never
// imports anything from `@/lib/trpc/router/qc` (the router file), which would
// drag `PrismaClient`/`advanceStageInternal` into the browser bundle.

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { recordResultInput } from "@/lib/validation/qc";

const inputClasses =
  "h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function QCResultForm({
  productionOrderId,
  formulaId,
}: {
  productionOrderId: string;
  formulaId: string;
}) {
  const router = useRouter();
  const [parameter, setParameter] = useState("");
  const [measuredValue, setMeasuredValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const specsQuery = trpc.qc.specsForFormula.useQuery({ formulaId });
  const recordResult = trpc.qc.recordResult.useMutation({
    onSuccess: () => {
      setParameter("");
      setMeasuredValue("");
      router.refresh();
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  // Case-insensitive match: the operator types the parameter name freehand
  // (via the datalist suggestions below), so "pH" and "ph" both resolve to
  // the same `QcSpecification` row.
  const matchingSpec = useMemo(
    () => specsQuery.data?.find((spec) => spec.parameter.toLowerCase() === parameter.trim().toLowerCase()),
    [specsQuery.data, parameter],
  );

  // Auto-derives pass/fail by comparing the measured value against the
  // matched spec's min/max (Step 6 of task-12-brief.md). No spec match, or no
  // numeric value yet, means no verdict can be derived — the form disables
  // submission in that case rather than guessing or defaulting to "pass".
  const derivedResult = useMemo<"pass" | "fail" | null>(() => {
    if (!matchingSpec || measuredValue.trim() === "") return null;
    const value = Number(measuredValue);
    if (Number.isNaN(value)) return null;
    const belowMin = matchingSpec.minValue !== null && value < matchingSpec.minValue;
    const aboveMax = matchingSpec.maxValue !== null && value > matchingSpec.maxValue;
    return belowMin || aboveMax ? "fail" : "pass";
  }, [matchingSpec, measuredValue]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (derivedResult === null) {
      setError("Ingrese un parámetro con especificación registrada y un valor medido numérico");
      return;
    }

    const parsed = recordResultInput.safeParse({
      productionOrderId,
      parameter: parameter.trim(),
      measuredValue: Number(measuredValue),
      result: derivedResult,
    });
    if (!parsed.success) {
      setError("Datos inválidos");
      return;
    }

    await recordResult.mutateAsync(parsed.data);
  };

  const datalistId = `qc-parameters-${productionOrderId}`;

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`qc-parameter-${productionOrderId}`} className="text-sm font-medium text-foreground">
          Parámetro
        </label>
        <input
          id={`qc-parameter-${productionOrderId}`}
          list={datalistId}
          value={parameter}
          onChange={(event) => setParameter(event.target.value)}
          placeholder="pH"
          className={inputClasses}
        />
        <datalist id={datalistId}>
          {specsQuery.data?.map((spec) => <option key={spec.id} value={spec.parameter} />)}
        </datalist>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`qc-value-${productionOrderId}`} className="text-sm font-medium text-foreground">
          Valor medido
        </label>
        <input
          id={`qc-value-${productionOrderId}`}
          type="number"
          step="any"
          inputMode="decimal"
          value={measuredValue}
          onChange={(event) => setMeasuredValue(event.target.value)}
          className={`${inputClasses} font-mono`}
        />
        {matchingSpec && (
          <p className="font-mono text-xs text-muted-foreground">
            Rango especificado: {matchingSpec.minValue ?? "—"} a {matchingSpec.maxValue ?? "—"}{" "}
            {matchingSpec.unit ?? ""}
          </p>
        )}
      </div>

      {derivedResult && (
        <p
          className={
            derivedResult === "fail" ? "text-sm font-semibold text-destructive" : "text-sm font-semibold text-success"
          }
        >
          Resultado calculado: {derivedResult === "fail" ? "FALLA" : "CONFORME"}
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={recordResult.isPending || derivedResult === null}>
        {recordResult.isPending ? "Guardando..." : "Registrar resultado"}
      </Button>
    </form>
  );
}
