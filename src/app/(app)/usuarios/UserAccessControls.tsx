"use client";

// Client Component: the role select and the activate/deactivate button need
// interactivity. Imports only the tRPC hooks and the schema-only validation
// module, never the router (keeps Prisma out of the browser bundle).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, ROLE_VALUES } from "@/lib/validation/users";

type Role = (typeof ROLE_VALUES)[number];

export function UserAccessControls({
  userId,
  fullName,
  role,
  active,
}: {
  userId: string;
  fullName: string;
  role: Role;
  active: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const update = trpc.users.update.useMutation({
    onSuccess: () => {
      setError(null);
      router.refresh();
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  function changeRole(next: Role) {
    if (next === role) return;
    const confirmed = window.confirm(
      `¿Cambiar el rol de ${fullName} de "${ROLE_LABELS[role]}" a "${ROLE_LABELS[next]}"? El cambio queda en la auditoría.`,
    );
    if (confirmed) update.mutate({ id: userId, role: next });
  }

  function toggleActive() {
    const confirmed = window.confirm(
      active
        ? `¿Desactivar a ${fullName}? No podrá entrar al sistema hasta que se reactive.`
        : `¿Reactivar a ${fullName}?`,
    );
    if (confirmed) update.mutate({ id: userId, active: !active });
  }

  const selectId = `role-${userId}`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor={selectId} className="sr-only">
          Rol de {fullName}
        </label>
        <select
          id={selectId}
          value={role}
          disabled={update.isPending || !active}
          onChange={(event) => changeRole(event.target.value as Role)}
          className="h-11 min-h-[44px] rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          {ROLE_VALUES.map((value) => (
            <option key={value} value={value}>
              {ROLE_LABELS[value]}
            </option>
          ))}
        </select>
        <Button
          variant={active ? "outline" : "default"}
          className="min-h-11"
          onClick={toggleActive}
          disabled={update.isPending}
        >
          {active ? "Desactivar" : "Reactivar"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
