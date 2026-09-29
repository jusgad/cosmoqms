"use client";

// Client Component: Clerk's `useReverification` hook and a tRPC mutation on
// submit require real interactivity — same reasoning as
// `src/components/batch/SignaturePad.tsx` (Task 11), whose pattern this
// mirrors for `qc.release` (task 12 review round 1: `release` had no way to
// actually be called through the product without this component, since
// `has({ reverification: "strict" })` can only become true via Clerk's
// step-up modal, which only `useReverification` triggers).
//
// Bundle-safety (Task 7-12 lesson, applied again here): this file imports
// `RELEASE_MEANING_STATEMENT` from `@/lib/validation/qc` (schema-only, zero
// dependency on `@/lib/trpc/trpc`/`@/lib/db`) and never imports anything from
// `@/lib/trpc/router/qc` (the router file), which would drag
// `PrismaClient`/`advanceStageInternal` into the browser bundle. It also
// reuses the existing generic `verifyReauthForSignature` Server Action
// (`produccion/[id]/firma/actions.ts`) rather than duplicating it — that
// action doesn't depend on stage, only on the current Clerk session.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useReverification } from "@clerk/nextjs";
import { isReverificationCancelledError } from "@clerk/nextjs/errors";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { RELEASE_MEANING_STATEMENT } from "@/lib/validation/qc";
import { verifyReauthForSignature } from "@/app/(app)/produccion/[id]/firma/actions";

export function ReleasePad({ productionOrderId }: { productionOrderId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [reauthVerified, setReauthVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Same wrapped-Server-Action pattern as SignaturePad.tsx: when Clerk's
  // reverification-error shape comes back, this hook shows the built-in
  // step-up modal (password/MFA) and retries, resolving to
  // `{ reauthVerified: true }` only once `has({ reverification: "strict" })`
  // is actually satisfied server-side.
  const enhancedVerify = useReverification(verifyReauthForSignature);

  const release = trpc.qc.release.useMutation();

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

  const handleRelease = async () => {
    setError(null);
    try {
      await release.mutateAsync({
        productionOrderId,
        meaningStatement: RELEASE_MEANING_STATEMENT,
        reauthVerified: true,
      });
      router.push(`/produccion/${productionOrderId}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error al liberar el lote");
    }
  };

  const isReleasing = release.isPending;

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Declaración de significado</span>
        <p className="rounded-card border border-border bg-card p-3 text-sm text-foreground" data-slot="meaning-statement">
          {RELEASE_MEANING_STATEMENT}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Reautenticación</span>
        {reauthVerified ? (
          <p className="text-sm text-success">Identidad verificada. Puede liberar el lote.</p>
        ) : (
          <Button type="button" variant="outline" onClick={handleReauth} disabled={isVerifying}>
            {isVerifying ? "Verificando..." : "Verificar identidad"}
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="button" onClick={handleRelease} disabled={!reauthVerified || isReleasing}>
        {isReleasing ? "Liberando..." : "Liberar lote"}
      </Button>
    </div>
  );
}
