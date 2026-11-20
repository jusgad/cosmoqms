"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";

const inputClasses =
  "h-11 min-h-[44px] rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type Values = { name: string; nit: string | null; invimaRegistration: string | null };

export function OrganizationForm({ initial }: { initial: Values }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [nit, setNit] = useState(initial.nit ?? "");
  const [invima, setInvima] = useState(initial.invimaRegistration ?? "");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const update = trpc.organization.update.useMutation({
    onSuccess: () => {
      setMessage({ tone: "ok", text: "Datos guardados. El cambio quedó en la auditoría." });
      router.refresh();
    },
    onError: (error) => setMessage({ tone: "error", text: error.message }),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    update.mutate({ name, nit, invimaRegistration: invima });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="org-name" className="text-sm font-medium text-foreground">
          Razón social
        </label>
        <input id="org-name" required value={name} onChange={(event) => setName(event.target.value)} className={inputClasses} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="org-nit" className="text-sm font-medium text-foreground">
          NIT
        </label>
        <input
          id="org-nit"
          value={nit}
          onChange={(event) => setNit(event.target.value)}
          placeholder="900.123.456-7"
          className={`${inputClasses} font-mono`}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="org-invima" className="text-sm font-medium text-foreground">
          Registro / certificación INVIMA
        </label>
        <input
          id="org-invima"
          value={invima}
          onChange={(event) => setInvima(event.target.value)}
          className={`${inputClasses} font-mono`}
        />
      </div>
      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-sm text-destructive" : "text-sm text-success"}>
          {message.text}
        </p>
      )}
      <Button type="submit" className="min-h-11" disabled={update.isPending}>
        {update.isPending ? "Guardando..." : "Guardar"}
      </Button>
    </form>
  );
}
