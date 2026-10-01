"use client";

// Client Component: Clerk's `useReverification` hook and a tRPC mutation on
// submit require real interactivity.
//
// Bundle-safety (Task 7-10 lesson, applied again here): this file imports the
// input schema and meaning-statement templates from
// `@/lib/validation/production` (schema-only, zero dependency on
// `@/lib/trpc/trpc`/`@/lib/db`) and never imports anything from
// `@/lib/trpc/router/production` (the router file), which would drag
// `PrismaClient` into the browser bundle. It also never imports
// `@/app/(app)/produccion/[id]/firma/actions` for anything other than the
// Server Action function reference itself — Next.js compiles that import
// into an opaque RPC reference on the client, never inlining the server
// module's `@clerk/nextjs/server`/Prisma code into this bundle.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useReverification } from "@clerk/nextjs";
import { isReverificationCancelledError } from "@clerk/nextjs/errors";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { SIGNATURE_MEANING_STATEMENTS, type SignableStage } from "@/lib/validation/production";
import { verifyReauthForSignature } from "@/app/(app)/produccion/[id]/firma/actions";

export function SignaturePad({
  productionOrderId,
  stage,
}: {
  productionOrderId: string;
  stage: SignableStage;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [reauthVerified, setReauthVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Wraps the Server Action: if it resolves to Clerk's reverification-error
  // shape, this hook shows the built-in step-up modal (password/MFA) and
  // retries the action once the user completes it. Only a plain
  // `{ reauthVerified: true }` resolution — meaning `has({ reverification })`
  // was already satisfied — reaches the `.then` below without the modal.
  const enhancedVerify = useReverification(verifyReauthForSignature);

  const sign = trpc.production.sign.useMutation();

  const meaningStatement = SIGNATURE_MEANING_STATEMENTS[stage] ?? "Confirmo la realización de esta etapa";

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

  const handleSign = async () => {
    setError(null);
    try {
      await sign.mutateAsync({
        productionOrderId,
        stage,
        meaningStatement,
        reauthVerified: true,
      });
      router.push(`/produccion/${productionOrderId}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error al registrar la firma");
    }
  };

  const isSigning = sign.isPending;

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Declaración de significado</span>
        <p className="rounded-card border border-border bg-card p-3 text-sm text-foreground" data-slot="meaning-statement">
          {meaningStatement}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Reautenticación</span>
        {reauthVerified ? (
          <p className="text-sm text-success">Identidad verificada. Puede firmar.</p>
        ) : (
          <Button type="button" variant="outline" onClick={handleReauth} disabled={isVerifying}>
            {isVerifying ? "Verificando..." : "Verificar identidad"}
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="button" onClick={handleSign} disabled={!reauthVerified || isSigning}>
        {isSigning ? "Firmando..." : "Firmar"}
      </Button>
    </div>
  );
}
