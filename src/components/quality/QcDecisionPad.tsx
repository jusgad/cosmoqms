"use client";

// Client Component: Clerk's `useReverification` hook and a tRPC mutation on
// submit require real interactivity — same reasoning as
// `src/components/batch/SignaturePad.tsx` (Task 11).
//
// Originally `ReleasePad.tsx` (Task 12 review round 1: `qc.release` had no
// way to be called through the product without it, since
// `has({ reverification: "strict" })` only becomes true via Clerk's step-up
// modal, which only `useReverification` triggers). Final review (Important
// 4) generalised it to the director_tecnico's two final QC decisions —
// `release` (`calidad -> liberado`) and `reject` (`calidad -> rechazado`) —
// which share the identical step-up + meaning-statement signature flow and
// differ only in the mutation, the statement and the labels. Otherwise the
// new `qc.reject` mutation would have been dead code again, the same UI gap
// Task 12 hit for `release`.
//
// Bundle-safety (Task 7-12 lesson): imports only schema-only constants from
// `@/lib/validation/qc` and never anything from `@/lib/trpc/router/qc` (which
// would drag `PrismaClient` into the browser bundle). Reuses the generic
// `verifyReauthForSignature` Server Action rather than duplicating it.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useReverification } from "@clerk/nextjs";
import { isReverificationCancelledError } from "@clerk/nextjs/errors";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { REJECT_MEANING_STATEMENT, RELEASE_MEANING_STATEMENT } from "@/lib/validation/qc";
import { verifyReauthForSignature } from "@/app/(app)/produccion/[id]/firma/actions";

export type QcDecision = "release" | "reject";

const COPY: Record<
  QcDecision,
  { statement: string; ready: string; action: string; pending: string; failure: string }
> = {
  release: {
    statement: RELEASE_MEANING_STATEMENT,
    ready: "Identidad verificada. Puede liberar el lote.",
    action: "Liberar lote",
    pending: "Liberando...",
    failure: "Error al liberar el lote",
  },
  reject: {
    statement: REJECT_MEANING_STATEMENT,
    ready: "Identidad verificada. Puede rechazar el lote.",
    action: "Rechazar lote",
    pending: "Rechazando...",
    failure: "Error al rechazar el lote",
  },
};

export function QcDecisionPad({ productionOrderId, decision }: { productionOrderId: string; decision: QcDecision }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [reauthVerified, setReauthVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Same wrapped-Server-Action pattern as SignaturePad.tsx: on Clerk's
  // reverification-error shape, this hook shows the built-in step-up modal
  // and retries, resolving to `{ reauthVerified: true }` only once
  // `has({ reverification: "strict" })` is actually satisfied server-side.
  const enhancedVerify = useReverification(verifyReauthForSignature);

  // Both hooks are always called (rules of hooks); only the one matching
  // `decision` is ever used.
  const release = trpc.qc.release.useMutation();
  const reject = trpc.qc.reject.useMutation();
  const mutation = decision === "release" ? release : reject;
  const copy = COPY[decision];

  const handleReauth = async () => {
    setError(null);
    setIsVerifying(true);
    try {
      const result = await enhancedVerify();
      if (result.reauthVerified) {
        setReauthVerified(true);
      }
    } catch (cause) {
      if (!isReverificationCancelledError(cause)) {
        setError("No se pudo completar la reautenticación.");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDecision = async () => {
    setError(null);
    try {
      await mutation.mutateAsync({
        productionOrderId,
        meaningStatement: copy.statement,
        reauthVerified: true,
      });
      router.push(`/produccion/${productionOrderId}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.failure);
    }
  };

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Declaración de significado</span>
        <p className="rounded-card border border-border bg-card p-3 text-sm text-foreground" data-slot="meaning-statement">
          {copy.statement}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Reautenticación</span>
        {reauthVerified ? (
          <p className="text-sm text-success">{copy.ready}</p>
        ) : (
          <Button type="button" variant="outline" onClick={handleReauth} disabled={isVerifying}>
            {isVerifying ? "Verificando..." : "Verificar identidad"}
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="button"
        variant={decision === "reject" ? "destructive" : "default"}
        onClick={handleDecision}
        disabled={!reauthVerified || mutation.isPending}
      >
        {mutation.isPending ? copy.pending : copy.action}
      </Button>
    </div>
  );
}
