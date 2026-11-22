import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { isReadOnly } from "@/lib/roles/modules";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [organization, unreadNotifications] = await withTenant(user.tenantId, user.id, (tx) =>
    Promise.all([
      tx.organization.findUnique({ where: { id: user.tenantId }, select: { name: true } }),
      tx.notification.count({ where: { tenantId: user.tenantId, recipientUserId: user.id, readAt: null } }),
    ]),
  );

  return (
    <div className="flex min-h-screen flex-col md:grid md:grid-cols-[240px_1fr]">
      <Sidebar role={user.role} />
      {/* min-w-0: lets wide content (the production Kanban) scroll inside
          its own container instead of stretching the grid column and the
          whole page sideways. */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header orgName={organization?.name ?? "CosmoQMS"} unreadNotifications={unreadNotifications} />
        {isReadOnly(user.role) && (
          <p role="status" className="border-b border-border bg-muted px-4 py-2 text-xs text-foreground md:px-6">
            Modo supervisión: como administrador ve todos los módulos en solo lectura. Pesar, firmar, liberar y aprobar
            corresponde a cada rol de planta y calidad.
          </p>
        )}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
