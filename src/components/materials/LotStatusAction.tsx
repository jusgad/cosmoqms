"use client";

// Client Component: the status-change buttons need onClick handlers and
// mutation/pending state — real interactivity, not just data display.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import type { LotStatus } from "@prisma/client";

export function LotStatusAction({ lotId, status }: { lotId: string; status: LotStatus }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const setStatus = trpc.materials.setStatus.useMutation({
    onSuccess: () => {
      router.refresh();
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  if (status !== "cuarentena") {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => {
            setError(null);
            setStatus.mutate({ id: lotId, status: "liberado" });
          }}
          disabled={setStatus.isPending}
        >
          Liberar lote
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            setError(null);
            setStatus.mutate({ id: lotId, status: "rechazado" });
          }}
          disabled={setStatus.isPending}
        >
          Rechazar lote
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
