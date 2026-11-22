import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { cn } from "@/lib/utils";
import { listUsers } from "@/lib/users/admin";
import { loadSeats, seatsLeft } from "@/lib/users/clerkSeats";
import { ROLE_LABELS } from "@/lib/validation/users";
import { UserAccessControls } from "@/app/(app)/usuarios/UserAccessControls";

// Server Component with the same `admin` gate as `usersRouter` (the page
// gate is never the only enforcement). New people appear here after they
// sign up in Clerk (the webhook creates them as `operario`).
export default async function UsuariosPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  const users = await withTenant(user.tenantId, user.id, (tx) => listUsers(tx, user.tenantId));
  const activeCount = users.filter((row) => row.active).length;
  const seats = await loadSeats(user.tenantId);
  const left = seats ? seatsLeft(seats) : null;

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-sans text-2xl font-semibold text-foreground">Usuarios</h1>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href="/roles">Roles y permisos</Link>} />
            <Button variant="outline" nativeButton={false} render={<Link href="/usuarios/revision">Revisión de accesos</Link>} />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {activeCount} activos de {users.length}. Las personas nuevas aparecen aquí al registrarse, con rol
          Operario. Cada cambio de rol o de estado queda en la auditoría.
        </p>
      </div>

      {seats && left !== null && (
        <p
          role="status"
          className={cn(
            "rounded-card border p-3 text-sm",
            left === 0 ? "border-pending bg-pending/10 text-foreground" : "border-border bg-card text-muted-foreground",
          )}
        >
          Cupos en Clerk: {seats.used} de {seats.max} usados.{" "}
          {left === 0
            ? "La organización está llena: una persona nueva no podrá entrar hasta liberar un cupo. Desactive aquí a quien ya no trabaja y sáquelo de la organización en el panel de Clerk (Organizations → Members), o amplíe el plan."
            : `Quedan ${left} para personas nuevas.`}
        </p>
      )}

      {users.length === 0 ? (
        <div className="rounded-card border border-border bg-card p-6 text-sm text-muted-foreground">
          Todavía no hay usuarios registrados.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {users.map((row) => {
            const isSelf = row.id === user.id;
            return (
              <li
                key={row.id}
                className={cn(
                  "flex flex-col gap-3 rounded-card border border-border bg-card p-4 md:flex-row md:items-center md:justify-between",
                  !row.active && "opacity-70",
                )}
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2 font-sans text-sm font-semibold text-foreground">
                    {row.fullName}
                    {isSelf && <span className="text-xs font-normal text-muted-foreground">(usted)</span>}
                    {!row.active && (
                      <span className="rounded-lg border border-destructive px-2 py-0.5 text-xs font-medium text-destructive">
                        Inactivo
                      </span>
                    )}
                  </span>
                  <span className="truncate font-mono text-xs text-muted-foreground">{row.email}</span>
                  {row.mfaEnabled && (
                    <span className="flex items-center gap-1 text-xs text-success">
                      <ShieldCheck className="size-4" aria-hidden />
                      MFA activo
                    </span>
                  )}
                </div>
                {isSelf ? (
                  <span className="text-sm text-muted-foreground">
                    {ROLE_LABELS[row.role]} · otro administrador debe cambiar su acceso
                  </span>
                ) : (
                  <UserAccessControls userId={row.id} fullName={row.fullName} role={row.role} active={row.active} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
