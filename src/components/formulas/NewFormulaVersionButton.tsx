"use client";

// Client Component: starts the change-control flow for an active formula and
// opens the new draft. The server copies ingredients and specifications.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GitBranchPlus } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";

export function NewFormulaVersionButton({ formulaId, nextVersion }: { formulaId: string; nextVersion: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const createVersion = trpc.formulas.createVersion.useMutation({
    onSuccess: (created) => router.push(`/formulas/${created.id}`),
    onError: (mutationError) => setError(mutationError.message),
  });

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        disabled={createVersion.isPending}
        onClick={() => {
          setError(null);
          createVersion.mutate({ id: formulaId });
        }}
      >
        <GitBranchPlus aria-hidden />
        {createVersion.isPending ? "Creando..." : `Crear versión ${nextVersion}`}
      </Button>
      <p className="text-xs text-muted-foreground">
        La versión actual sigue activa hasta que calidad active la nueva; entonces esta queda archivada.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
