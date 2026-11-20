"use client";

// Client Component: Clerk's `useReverification` step-up and the approval
// mutation. Same wrapped-Server-Action pattern as SignaturePad/QcDecisionPad;
// the server re-checks the re-verification itself (`assertReverified`).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useReverification } from "@clerk/nextjs";
import { isReverificationCancelledError } from "@clerk/nextjs/errors";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { SOP_APPROVAL_MEANING_STATEMENT } from "@/lib/validation/sops";
import { verifyReauthForSignature } from "@/app/(app)/produccion/[id]/firma/actions";

const inputClasses =
  "h-11 min-h-[44px] rounded-lg border border-border bg-card px-3 font-mono text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function SopApprovalPad({ sopId, hasDocument }: { sopId: string; hasDocument: boolean }) {
  const router = useRouter();
  const today = new Date();
  const inTwoYears = new Date(Date.UTC(today.getUTCFullYear() + 2, today.getUTCMonth(), today.getUTCDate()));
  const [effectiveDate, setEffectiveDate] = useState(isoDay(today));
  const [reviewDue, setReviewDue] = useState(isoDay(inTwoYears));
  const [reauthVerified, setReauthVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enhancedVerify = useReverification(verifyReauthForSignature);
  const approve = trpc.sops.approve.useMutation();

  const handleReauth = async () => {
    setError(null);
    setIsVerifying(true);
    try {
      const result = await enhancedVerify();
      if (result.reauthVerified) setReauthVerified(true);
    } catch (cause) {
      if (!isReverificationCancelledError(cause)) setError("No se pudo completar la reautenticación.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleApprove = async () => {
    setError(null);
    try {
      await approve.mutateAsync({
        id: sopId,
        effectiveDate,
        reviewDue,
        meaningStatement: SOP_APPROVAL_MEANING_STATEMENT,
        reauthVerified: true,
      });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error al aprobar el procedimiento");
    }
  };

  return (
    <section aria-labelledby="approval-title" className="flex max-w-lg flex-col gap-4 rounded-card border border-border bg-card p-4">
      <h2 id="approval-title" className="font-sans text-lg font-semibold text-foreground">
        Aprobación (firma electrónica)
      </h2>
      {!hasDocument && (
        <p className="text-sm text-pending">Adjunte primero el documento en PDF; sin documento no se puede aprobar.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sop-effective" className="text-sm font-medium text-foreground">
            Vigente desde
          </label>
          <input id="sop-effective" type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} className={inputClasses} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sop-review" className="text-sm font-medium text-foreground">
            Próxima revisión
          </label>
          <input id="sop-review" type="date" value={reviewDue} onChange={(event) => setReviewDue(event.target.value)} className={inputClasses} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Declaración de significado</span>
        <p className="rounded-card border border-border bg-background p-3 text-sm text-foreground" data-slot="meaning-statement">
          {SOP_APPROVAL_MEANING_STATEMENT}
        </p>
      </div>

      {reauthVerified ? (
        <p className="text-sm text-success">Identidad verificada. Puede aprobar.</p>
      ) : (
        <Button type="button" variant="outline" className="min-h-11" onClick={handleReauth} disabled={isVerifying || !hasDocument}>
          {isVerifying ? "Verificando..." : "Verificar identidad"}
        </Button>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="button" className="min-h-11" onClick={handleApprove} disabled={!reauthVerified || !hasDocument || approve.isPending}>
        {approve.isPending ? "Aprobando..." : "Aprobar como vigente"}
      </Button>
    </section>
  );
}
