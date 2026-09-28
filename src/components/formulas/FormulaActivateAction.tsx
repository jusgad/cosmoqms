"use client";

// Client Component: the "Activar" button needs onClick/mutation state and
// must surface the server's BAD_REQUEST message inline — real interactivity.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";

export function FormulaActivateAction({ formulaId }: { formulaId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const activate = trpc.formulas.activate.useMutation({
    onSuccess: () => {
      setError(null);
      router.refresh();
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={() => {
          setError(null);
          activate.mutate({ id: formulaId });
        }}
        disabled={activate.isPending}
      >
        {activate.isPending ? "Activando..." : "Activar"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
