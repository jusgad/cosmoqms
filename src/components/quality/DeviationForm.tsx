"use client";

// Client Component: capturing investigation/corrective-action text and
// submitting tRPC mutations requires real interactivity (useState +
// useMutation) — same reasoning as QCResultForm.tsx (Task 12).
//
// Bundle-safety (Task 7 lesson, applied again here): this file imports its
// input schemas from `@/lib/validation/deviations` (schema-only, zero
// dependency on `@/lib/trpc/trpc`/`@/lib/db`) and never imports anything from
// `@/lib/trpc/router/deviations` (the router file), which would drag
// `PrismaClient` into the browser bundle.
//
// Non-negotiable (task-13-brief.md, mirrored from qc.release/Task 12): the
// "Aprobar" button is only ever RENDERED when `userRole === "director_tecnico"`
// — this is a UX convenience, never the actual authorization boundary. The
// real enforcement is server-side, in `deviations.approve`'s
// `roleProcedure("director_tecnico")` (src/lib/trpc/router/deviations.ts) —
// anyone hitting the tRPC endpoint directly without that role is rejected
// with FORBIDDEN regardless of what this component renders.

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { investigateDeviationInput } from "@/lib/validation/deviations";
import type { Role } from "@prisma/client";

const textareaClasses =
  "min-h-24 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export type DeviationDetail = {
  id: string;
  description: string;
  investigation: string | null;
  correctiveAction: string | null;
  status: "abierta" | "en_investigacion" | "pendiente_aprobacion" | "cerrada";
};

export function DeviationForm({ deviation, userRole }: { deviation: DeviationDetail; userRole: Role }) {
  const router = useRouter();
  const [investigation, setInvestigation] = useState(deviation.investigation ?? "");
  const [correctiveAction, setCorrectiveAction] = useState(deviation.correctiveAction ?? "");
  const [error, setError] = useState<string | null>(null);

  const investigate = trpc.deviations.investigate.useMutation({
    onSuccess: () => router.refresh(),
    onError: (mutationError) => setError(mutationError.message),
  });
  const approve = trpc.deviations.approve.useMutation({
    onSuccess: () => router.refresh(),
    onError: (mutationError) => setError(mutationError.message),
  });

  const canEditInvestigation = deviation.status === "abierta" || deviation.status === "en_investigacion";
  const canApprove = userRole === "director_tecnico" && deviation.status === "pendiente_aprobacion";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const parsed = investigateDeviationInput.safeParse({
      id: deviation.id,
      investigation: investigation.trim(),
      correctiveAction: correctiveAction.trim(),
    });
    if (!parsed.success) {
      setError("Documente la investigación y la acción correctiva (mínimo 10 caracteres cada una)");
      return;
    }

    await investigate.mutateAsync(parsed.data);
  };

  const handleApprove = async () => {
    setError(null);
    await approve.mutateAsync({ id: deviation.id });
  };

  return (
    <div className="flex max-w-lg flex-col gap-6">
      {canEditInvestigation ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`investigation-${deviation.id}`} className="text-sm font-medium text-foreground">
              Investigación
            </label>
            <textarea
              id={`investigation-${deviation.id}`}
              value={investigation}
              onChange={(event) => setInvestigation(event.target.value)}
              className={textareaClasses}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`corrective-action-${deviation.id}`} className="text-sm font-medium text-foreground">
              Acción correctiva/preventiva
            </label>
            <textarea
              id={`corrective-action-${deviation.id}`}
              value={correctiveAction}
              onChange={(event) => setCorrectiveAction(event.target.value)}
              className={textareaClasses}
            />
          </div>

          <Button type="submit" disabled={investigate.isPending}>
            {investigate.isPending ? "Enviando..." : "Enviar para aprobación"}
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Investigación</span>
            <p className="rounded-card border border-border bg-card p-3 text-sm text-foreground">
              {deviation.investigation}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Acción correctiva/preventiva</span>
            <p className="rounded-card border border-border bg-card p-3 text-sm text-foreground">
              {deviation.correctiveAction}
            </p>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Client-side gate mirroring the server-side `roleProcedure("director_tecnico")`
          on `deviations.approve` — never the only enforcement (see file header). */}
      {userRole === "director_tecnico" && deviation.status === "pendiente_aprobacion" && (
        <Button type="button" onClick={handleApprove} disabled={!canApprove || approve.isPending}>
          {approve.isPending ? "Aprobando..." : "Aprobar y cerrar"}
        </Button>
      )}

      {deviation.status === "cerrada" && <p className="text-sm font-semibold text-success">Desviación cerrada.</p>}
    </div>
  );
}
