"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { SOP_ACK_STATEMENT } from "@/lib/validation/sops";

export function AcknowledgeButton({ sopId }: { sopId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const acknowledge = trpc.sops.acknowledge.useMutation({
    onSuccess: () => router.refresh(),
    onError: (mutationError) => setError(mutationError.message),
  });

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-foreground">{SOP_ACK_STATEMENT}.</p>
      <Button className="min-h-11 self-start" onClick={() => acknowledge.mutate({ id: sopId })} disabled={acknowledge.isPending}>
        {acknowledge.isPending ? "Registrando..." : "Confirmar lectura"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
