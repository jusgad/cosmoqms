"use client";

// Client Component: controlled form + tRPC mutation. Imports only the
// schema-only validation module, never the router.
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";

const inputClasses =
  "h-11 min-h-[44px] rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60";

export function SopDraftForm({ initialCode, initialTitle }: { initialCode: string; initialTitle: string }) {
  const router = useRouter();
  const isNewVersion = initialCode.length > 0;
  const [code, setCode] = useState(initialCode);
  const [title, setTitle] = useState(initialTitle);
  const [changeSummary, setChangeSummary] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = trpc.sops.create.useMutation({
    onSuccess: (sop) => router.push(`/sops/${sop.id}`),
    onError: (mutationError) => setError(mutationError.message),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    create.mutate({ code, title, changeSummary: changeSummary || undefined });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="sop-code" className="text-sm font-medium text-foreground">
          Código
        </label>
        <input
          id="sop-code"
          required
          value={code}
          disabled={isNewVersion}
          onChange={(event) => setCode(event.target.value)}
          placeholder="SOP-LIM-001"
          className={`${inputClasses} font-mono`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="sop-title" className="text-sm font-medium text-foreground">
          Título
        </label>
        <input id="sop-title" required value={title} onChange={(event) => setTitle(event.target.value)} className={inputClasses} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="sop-change" className="text-sm font-medium text-foreground">
          {isNewVersion ? "Qué cambia en esta versión" : "Descripción (opcional)"}
        </label>
        <textarea
          id="sop-change"
          rows={3}
          required={isNewVersion}
          value={changeSummary}
          onChange={(event) => setChangeSummary(event.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" className="min-h-11" disabled={create.isPending}>
        {create.isPending ? "Creando..." : "Crear borrador"}
      </Button>
    </form>
  );
}
